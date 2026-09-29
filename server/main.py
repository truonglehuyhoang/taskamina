from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import run_migrations
from app.routers import activity_logs, day_plans, tasks

@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations() # Chạy trước khi API nhận request
    yield            # App hoạt động; sau yield là phần shutdown nếu cần

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
