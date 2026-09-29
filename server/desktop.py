import argparse
import socket
import threading
import time
import urllib.request
import webbrowser

import uvicorn

from app.database import configure_data_dir
from app.storage_setup import prepare_storage, show_storage_error

HOST = "127.0.0.1"


def wait_for_server(base_url: str, worker: threading.Thread):
    health_url = f"{base_url}/api/health"

    for _ in range(100):
        if not worker.is_alive():
            raise RuntimeError("Taskamina server stopped during startup")

        try:
            with urllib.request.urlopen(health_url, timeout=0.5) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(0.1)

    raise RuntimeError("Taskamina server did not become ready")


def run_in_browser(base_url: str, worker: threading.Thread):
    print(f"Opening {base_url} in the default browser")
    webbrowser.open(base_url)

    try:
        while worker.is_alive():
            worker.join(timeout=0.5)
    except KeyboardInterrupt:
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--browser",
        action="store_true",
        help="Open in the default browser instead of a desktop window",
    )
    parser.add_argument(
        "--choose-data",
        action="store_true",
        help="Choose or change the Taskamina data folder",
    )
    args = parser.parse_args()

    try:
        data_dir = prepare_storage(force_choose=args.choose_data)
    except Exception as exc:
        show_storage_error(exc)
        raise SystemExit(1) from exc

    if data_dir is None:
        return

    configure_data_dir(data_dir)

    from main import app

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind((HOST, 0))
        listener.listen(2048)

        port = listener.getsockname()[1]
        base_url = f"http://{HOST}:{port}"

        config = uvicorn.Config(
            app,
            host=HOST,
            port=port,
            loop="asyncio",
            http="h11",
            ws="none",
            lifespan="on",
            access_log=False,
            log_level="info",
        )
        server = uvicorn.Server(config)
        worker = threading.Thread(
            target=server.run,
            kwargs={"sockets": [listener]},
            daemon=True,
        )
        worker.start()

        try:
            wait_for_server(base_url, worker)
            print(f"Taskamina: {base_url}")
            print(f"Data folder: {data_dir}")

            if args.browser:
                run_in_browser(base_url, worker)
            else:
                try:
                    import webview

                    webview.create_window(
                        "Taskamina",
                        base_url,
                        width=1180,
                        height=760,
                        min_size=(380, 560),
                    )
                    webview.start(gui="edgechromium")
                except Exception as exc:
                    print(f"Desktop window unavailable: {exc}")
                    run_in_browser(base_url, worker)
        finally:
            server.should_exit = True
            worker.join(timeout=5)


if __name__ == "__main__":
    main()