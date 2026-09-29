import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import run_migrations
from app.routers import activity_logs, day_plans, tasks


@asynccontextmanager
async def lifespan(_app: FastAPI):
    run_migrations()
    yield


app = FastAPI(title="Taskamina API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(day_plans.router)
app.include_router(tasks.router)
app.include_router(activity_logs.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


if getattr(sys, "frozen", False):
    frontend_dir = Path(sys._MEIPASS) / "client_dist"
    if not frontend_dir.is_dir():
        raise RuntimeError("Bundled frontend files are missing")
else:
    frontend_dir = Path(__file__).resolve().parent.parent / "client" / "dist"

if frontend_dir.is_dir():
    app.mount(
        "/",
        StaticFiles(directory=str(frontend_dir), html=True),
        name="frontend",
    )