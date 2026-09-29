import json
import os
import sqlite3
import tempfile
import tkinter as tk
from contextlib import closing
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from uuid import uuid4

local_app_data = os.environ.get("LOCALAPPDATA")
if not local_app_data:
    raise RuntimeError("LOCALAPPDATA is not available")

APP_DIR = Path(local_app_data) / "Taskamina"
DEFAULT_DATA_DIR = APP_DIR / "data"
CONFIG_PATH = APP_DIR / "settings.json"
DB_NAME = "taskamina.db"


def read_saved_folder() -> Path | None:
    if not CONFIG_PATH.exists():
        return None

    data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))

    if not isinstance(data, dict) or data.get("version") != 1:
        raise ValueError(f"Invalid storage settings: {CONFIG_PATH}")

    raw_path = data.get("data_dir")
    if not isinstance(raw_path, str) or not raw_path:
        raise ValueError(f"Invalid data directory in {CONFIG_PATH}")

    folder = Path(raw_path)
    if not folder.is_absolute():
        raise ValueError(f"Data directory must be absolute: {raw_path}")

    return folder.resolve()


def save_folder(folder: Path) -> None:
    APP_DIR.mkdir(parents=True, exist_ok=True)

    temporary = CONFIG_PATH.with_name(f".settings-{uuid4().hex}.json")
    try:
        temporary.write_text(
            json.dumps(
                {"version": 1, "data_dir": str(folder)},
                indent=2,
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        os.replace(temporary, CONFIG_PATH)
    finally:
        temporary.unlink(missing_ok=True)


def validate_database(database_path: Path) -> None:
    if not database_path.is_file():
        raise ValueError(f"Database is not a file: {database_path}")

    with closing(sqlite3.connect(database_path)) as connection:
        result = connection.execute("PRAGMA quick_check").fetchone()
        if result is None or result[0] != "ok":
            raise ValueError(f"Database integrity check failed: {database_path}")

        table = connection.execute(
            """
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = 'schema_migrations'
            """
        ).fetchone()
        if table is None:
            raise ValueError(
                f"This is not a Taskamina database: {database_path}"
            )


def check_writable(folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(
        dir=folder,
        prefix=".taskamina-write-test-",
    ) as test_file:
        test_file.write(b"ok")
        test_file.flush()


def backup_database(source: Path, destination: Path) -> None:
    validate_database(source)

    if destination.exists():
        raise FileExistsError(f"Database already exists: {destination}")

    temporary = destination.with_name(f".taskamina-{uuid4().hex}.db")

    try:
        with closing(sqlite3.connect(source)) as source_connection:
            with closing(sqlite3.connect(temporary)) as target_connection:
                source_connection.backup(target_connection)

        validate_database(temporary)

        # On Windows, rename fails if another process created destination.
        temporary.rename(destination)
    finally:
        temporary.unlink(missing_ok=True)


def choose_folder(root: tk.Tk, initial_folder: Path) -> Path | None:
    result: Path | None = None

    dialog = tk.Toplevel(root)
    dialog.title("Taskamina - Data location")
    dialog.geometry("560x245")
    dialog.minsize(460, 245)
    dialog.resizable(True, False)

    content = ttk.Frame(dialog, padding=20)
    content.pack(fill="both", expand=True)
    content.columnconfigure(0, weight=1)

    ttk.Label(
        content,
        text="Where should Taskamina save your data?",
        font=("Segoe UI", 13, "bold"),
    ).grid(row=0, column=0, columnspan=2, sticky="w")

    ttk.Label(
        content,
        text=(
            "Your plans and activity logs stay on this computer. "
            "Choose a folder you can access whenever you use the app."
        ),
        wraplength=500,
    ).grid(row=1, column=0, columnspan=2, sticky="w", pady=(10, 20))

    ttk.Label(content, text="Save folder").grid(
        row=2, column=0, sticky="w"
    )

    path_value = tk.StringVar(value=str(initial_folder))

    ttk.Entry(
        content,
        textvariable=path_value,
    ).grid(row=3, column=0, sticky="ew", pady=(6, 0), padx=(0, 8))

    def browse() -> None:
        current = Path(path_value.get()).expanduser()
        initial_dir = current if current.is_dir() else Path.home()

        selected = filedialog.askdirectory(
            parent=dialog,
            title="Choose Taskamina data folder",
            initialdir=str(initial_dir),
            mustexist=True,
        )
        if not selected:
            return

        folder = Path(selected).resolve()

        # Selecting D:\ means D:\Taskamina, not D:\taskamina.db.
        if folder == Path(folder.anchor):
            folder = folder / "Taskamina"

        path_value.set(str(folder))

    ttk.Button(content, text="Browse...", command=browse).grid(
        row=3, column=1, sticky="e", pady=(6, 0)
    )

    def continue_setup() -> None:
        nonlocal result

        raw_path = path_value.get().strip()
        if not raw_path:
            messagebox.showerror(
                "Taskamina",
                "Choose a data folder.",
                parent=dialog,
            )
            return

        folder = Path(raw_path).expanduser()
        if not folder.is_absolute():
            messagebox.showerror(
                "Taskamina",
                "Enter an absolute folder path.",
                parent=dialog,
            )
            return

        result = folder.resolve()
        dialog.destroy()

    actions = ttk.Frame(content)
    actions.grid(row=4, column=0, columnspan=2, sticky="e", pady=(24, 0))

    ttk.Button(
        actions,
        text="Use default",
        command=lambda: path_value.set(str(DEFAULT_DATA_DIR)),
    ).pack(side="left", padx=(0, 8))

    ttk.Button(
        actions,
        text="Continue",
        command=continue_setup,
    ).pack(side="left")

    dialog.protocol("WM_DELETE_WINDOW", dialog.destroy)
    dialog.grab_set()
    dialog.focus_force()
    root.wait_window(dialog)

    return result


def prepare_storage(force_choose: bool = False) -> Path | None:
    saved_folder = read_saved_folder()

    if (
        saved_folder is not None
        and not force_choose
        and saved_folder.is_dir()
        and (saved_folder / DB_NAME).is_file()
    ):
        validate_database(saved_folder / DB_NAME)
        return saved_folder

    root = tk.Tk()
    root.withdraw()

    try:
        source_folder = saved_folder or DEFAULT_DATA_DIR
        source_database = source_folder / DB_NAME

        if saved_folder is not None and not source_database.is_file():
            messagebox.showwarning(
                "Taskamina data unavailable",
                (
                    f"Your saved data location is unavailable:\n\n"
                    f"{saved_folder}\n\n"
                    "Reconnect that drive, or choose another folder. "
                    "Taskamina will not silently create a new database."
                ),
                parent=root,
            )

        chosen_folder = choose_folder(root, source_folder)
        if chosen_folder is None:
            return None

        check_writable(chosen_folder)
        chosen_database = chosen_folder / DB_NAME

        if chosen_database.exists():
            validate_database(chosen_database)

            if chosen_folder != source_folder:
                confirmed = messagebox.askyesno(
                    "Use existing data?",
                    (
                        f"This folder already contains a Taskamina database:\n\n"
                        f"{chosen_database}\n\n"
                        "Open this database? Data in the previous folder "
                        "will not be deleted."
                    ),
                    parent=root,
                )
                if not confirmed:
                    return None

        elif source_database.is_file() and chosen_folder != source_folder:
            confirmed = messagebox.askyesno(
                "Copy existing data?",
                (
                    f"Copy your existing Taskamina data to:\n\n"
                    f"{chosen_folder}\n\n"
                    "The original database will be kept as a backup."
                ),
                parent=root,
            )
            if not confirmed:
                return None

            backup_database(source_database, chosen_database)

        elif saved_folder is not None and not source_database.is_file():
            confirmed = messagebox.askyesno(
                "Start with new data?",
                (
                    "The previously selected database cannot be found.\n\n"
                    f"Create a new database in:\n{chosen_folder}\n\n"
                    "This will not delete data from the previous location."
                ),
                parent=root,
            )
            if not confirmed:
                return None

        save_folder(chosen_folder)
        return chosen_folder
    finally:
        root.destroy()


def show_storage_error(error: Exception) -> None:
    root = tk.Tk()
    root.withdraw()
    try:
        messagebox.showerror(
            "Taskamina could not open your data",
            str(error),
            parent=root,
        )
    finally:
        root.destroy()