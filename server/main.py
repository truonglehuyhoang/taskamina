import sqlite3
import uuid
from datetime import date
import json
import math

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal

from app.database import get_connection, run_migrations

app = FastAPI(title="Taskamina API")

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


class CreateDayPlanInput(BaseModel):
    user_id: str
    plan_date: date

class CreateCheckInInput(BaseModel):
    checkin_type: Literal["morning", "midday", "evening", "manual"]
    sleep_quality: Literal["poor", "okay", "good"]
    mood_level: Literal["low", "neutral", "good"]
    stress_level: Literal["low", "medium", "high"]
    day_mode: Literal["survival", "tired", "normal", "focused"]
    note: str | None = Field(default=None, max_length=2000)

class CreateTaskInput(BaseModel):
    task_type_id: str = "general"
    task_kind: Literal["work", "rest"] = "work"
    name: str = Field(min_length=1, max_length=255)
    duration_minutes: int = Field(ge=5, le=720)
    intensity_level: int = Field(ge=1, le=3)
    estimated_energy_cost: int = Field(default=0, ge=0)
    status: Literal["pending"] = "pending"

def compute_rest_gain(duration_minutes: int, previous_rest_count: int) -> int:
    base_gain = {15: 10, 30: 20, 60: 30}[duration_minutes]
    effectiveness = max(0.5, 1 - previous_rest_count * 0.2)
    return math.floor(base_gain * effectiveness + 0.5)

class UpdateTaskStatusInput(BaseModel):
    status: Literal["doing", "done", "skipped"]

def compute_energy_budget(payload: CreateCheckInInput) -> int:
    budgets = {
        "survival": 40,
        "tired": 60,
        "normal": 80,
        "focused": 100,
    }
    return budgets[payload.day_mode]

def compute_task_cost(duration_minutes: int, intensity_level: int) -> int:
    multipliers = {1: 0.8, 2: 1.0, 3: 1.3}

    base_cost = (
        duration_minutes / 3
        if duration_minutes <= 60
        else 20 + (duration_minutes - 60) * 0.25
    )
    return math.floor(base_cost * multipliers[intensity_level] + 0.5)

def create_activity_log(
    connection,
    day_plan_id: str,
    event_type: str,
    result: str,
    energy_before: int,
    energy_after: int,
    task_id: str | None = None,
    metadata: dict | None = None,
):
    connection.execute(
        """
        INSERT INTO activity_logs (
            activity_log_id,
            day_plan_id,
            task_id,
            event_type,
            result,
            energy_before,
            energy_after,
            metadata_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            day_plan_id,
            task_id,
            event_type,
            result,
            energy_before,
            energy_after,
            json.dumps(metadata) if metadata else None,
        ),
    )

class CreateTaskFeedbackInput(BaseModel):
    actual_duration_minutes: int = Field(gt=0, le=1440)
    perceived_intensity: int = Field(ge=1, le=3)
    energy_result: Literal["lighter", "as_expected", "heavier"]
    energy_before: int = Field(ge=0, le=100)
    energy_after: int = Field(ge=0, le=100)
    actual_energy_cost: int = Field(ge=0, le=100)

@app.on_event("startup")
def startup():
    run_migrations()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/day-plans")
def get_day_plan(
    user_id: str = Query(...),
    plan_date: date = Query(...),
):
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT *
            FROM day_plans
            WHERE user_id = ? AND plan_date = ?
            """,
            (user_id, plan_date.isoformat()),
        ).fetchone()

    return dict(row) if row else None


@app.post("/api/day-plans", status_code=status.HTTP_201_CREATED)
def create_day_plan(payload: CreateDayPlanInput):
    day_plan_id = str(uuid.uuid4())

    with get_connection() as connection:
        user = connection.execute(
            "SELECT user_id FROM users WHERE user_id = ?",
            (payload.user_id,),
        ).fetchone()

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found",
            )

        try:
            connection.execute(
                """
                INSERT INTO day_plans (
                    day_plan_id,
                    user_id,
                    plan_date
                )
                VALUES (?, ?, ?)
                """,
                (
                    day_plan_id,
                    payload.user_id,
                    payload.plan_date.isoformat(),
                ),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(
                status_code=409,
                detail="A day plan already exists for this date",
            )

        row = connection.execute(
            "SELECT * FROM day_plans WHERE day_plan_id = ?",
            (day_plan_id,),
        ).fetchone()

    return dict(row)

@app.post("/api/day-plans/{day_plan_id}/check-ins")
def create_check_in(
    day_plan_id: str,
    payload: CreateCheckInInput,
):
    with get_connection() as connection:
        plan = connection.execute(
            "SELECT * FROM day_plans WHERE day_plan_id = ?",
            (day_plan_id,),
        ).fetchone()

        if not plan:
            raise HTTPException(
                status_code=404,
                detail="Day plan not found",
            )

        existing_check_in = connection.execute(
            """
            SELECT checkin_id
            FROM daily_check_ins
            WHERE day_plan_id = ? AND checkin_type = ?
            """,
            (day_plan_id, payload.checkin_type),
        ).fetchone()

        if existing_check_in:
            raise HTTPException(
                status_code=409,
                detail="This check-in type already exists for the day plan",
            )

        energy_budget = compute_energy_budget(payload)

        has_check_in = connection.execute(
            "SELECT 1 FROM daily_check_ins WHERE day_plan_id = ? LIMIT 1",
            (day_plan_id,),
        ).fetchone() is not None

        connection.execute(
            """
            INSERT INTO daily_check_ins (
                checkin_id,
                day_plan_id,
                checkin_type,
                sleep_quality,
                mood_level,
                stress_level,
                day_mode,
                computed_energy_budget,
                note
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                day_plan_id,
                payload.checkin_type,
                payload.sleep_quality,
                payload.mood_level,
                payload.stress_level,
                payload.day_mode,
                energy_budget,
                payload.note,
            ),
        )

        # Morning check-in initializes today's usable energy.
        if not has_check_in:
            connection.execute(
                """
                UPDATE day_plans
                SET
                    energy_budget = ?,
                    remaining_energy = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE day_plan_id = ?
                """,
                (energy_budget, energy_budget, day_plan_id),
            )

        updated_plan = connection.execute(
            "SELECT * FROM day_plans WHERE day_plan_id = ?",
            (day_plan_id,),
        ).fetchone()

    return dict(updated_plan)

@app.get("/api/day-plans/{day_plan_id}/tasks")
def get_tasks(day_plan_id: str):
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM tasks
            WHERE day_plan_id = ?
            ORDER BY position ASC, created_at ASC
            """,
            (day_plan_id,),
        ).fetchall()

    return [dict(row) for row in rows]


@app.post("/api/day-plans/{day_plan_id}/tasks", status_code=201)
def create_task(day_plan_id: str, payload: CreateTaskInput):
    with get_connection() as connection:
        plan = connection.execute(
            "SELECT * FROM day_plans WHERE day_plan_id = ?",
            (day_plan_id,),
        ).fetchone()
        if not plan:
            raise HTTPException(status_code=404, detail="Day plan not found")

        task_name = payload.name.strip()
        if not task_name:
            raise HTTPException(status_code=422, detail="Task name is required")

        expected_type = "rest" if payload.task_kind == "rest" else payload.task_type_id
        task_type = connection.execute(
            "SELECT task_type_id FROM task_types WHERE task_type_id = ?",
            (expected_type,),
        ).fetchone()
        if not task_type:
            raise HTTPException(status_code=422, detail="Task type not found")

        if payload.task_kind == "rest":
            if payload.duration_minutes not in (15, 30, 60):
                raise HTTPException(
                    status_code=422,
                    detail="Rest duration must be 15, 30, or 60 minutes",
                )
            previous_rest_count = connection.execute(
                """
                SELECT COUNT(*) AS total
                FROM tasks
                WHERE day_plan_id = ? AND task_kind = 'rest'
                """,
                (day_plan_id,),
            ).fetchone()["total"]
            estimated_cost = 0
            estimated_gain = compute_rest_gain(
                payload.duration_minutes, previous_rest_count
            )
        else:
            estimated_cost = compute_task_cost(
                payload.duration_minutes, payload.intensity_level
            )
            estimated_gain = 0

        position = connection.execute(
            """
            SELECT COALESCE(MAX(position), -1) + 1 AS next_position
            FROM tasks WHERE day_plan_id = ?
            """,
            (day_plan_id,),
        ).fetchone()["next_position"]

        task_id = str(uuid.uuid4())
        connection.execute(
            """
            INSERT INTO tasks (
                task_id, day_plan_id, task_type_id, task_kind, name,
                duration_minutes, intensity_level, estimated_energy_cost,
                estimated_recovery_gain, status, position
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            """,
            (
                task_id, day_plan_id, expected_type, payload.task_kind,
                task_name, payload.duration_minutes, payload.intensity_level,
                estimated_cost, estimated_gain, position,
            ),
        )

        create_activity_log(
            connection=connection,
            day_plan_id=day_plan_id,
            task_id=task_id,
            event_type="task_created",
            result="added",
            energy_before=plan["remaining_energy"],
            energy_after=plan["remaining_energy"],
            metadata={"task_name": task_name, "task_kind": payload.task_kind},
        )

        task = connection.execute(
            "SELECT * FROM tasks WHERE task_id = ?", (task_id,)
        ).fetchone()

    return dict(task)


@app.patch("/api/tasks/{task_id}")
def update_task_status(task_id: str, payload: UpdateTaskStatusInput):
    with get_connection() as connection:
        task = connection.execute(
            "SELECT * FROM tasks WHERE task_id = ?", (task_id,)
        ).fetchone()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        plan = connection.execute(
            "SELECT * FROM day_plans WHERE day_plan_id = ?",
            (task["day_plan_id"],),
        ).fetchone()

        if task["status"] in ("done", "skipped"):
            if task["status"] == payload.status:
                return dict(plan)
            raise HTTPException(
                status_code=409, detail="Completed or skipped task cannot be reopened"
            )

        before = plan["remaining_energy"]
        after = before
        event_type = "task_started"
        result = "info"

        if payload.status == "done":
            if task["task_kind"] == "rest":
                after = min(
                    plan["energy_budget"],
                    before + task["estimated_recovery_gain"],
                )
                event_type = "rest_completed"
                result = "rest"
            else:
                after = max(0, before - task["estimated_energy_cost"])
                event_type = "task_completed"
                result = (
                    "success"
                    if before >= task["estimated_energy_cost"]
                    else "strained"
                )

            connection.execute(
                """
                UPDATE day_plans
                SET remaining_energy = ?, updated_at = CURRENT_TIMESTAMP
                WHERE day_plan_id = ?
                """,
                (after, plan["day_plan_id"]),
            )
        elif payload.status == "skipped":
            event_type = "task_skipped"
            result = "skipped"

        connection.execute(
            """
            UPDATE tasks
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE task_id = ?
            """,
            (payload.status, task_id),
        )

        create_activity_log(
            connection=connection,
            day_plan_id=plan["day_plan_id"],
            task_id=task_id,
            event_type=event_type,
            result=result,
            energy_before=before,
            energy_after=after,
            metadata={
                "task_name": task["name"],
                "task_kind": task["task_kind"],
                "energy_change": after - before,
            },
        )

        updated_plan = connection.execute(
            "SELECT * FROM day_plans WHERE day_plan_id = ?",
            (plan["day_plan_id"],),
        ).fetchone()

    return dict(updated_plan)


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: str):
    with get_connection() as connection:
        task = connection.execute(
            "SELECT * FROM tasks WHERE task_id = ?",
            (task_id,),
        ).fetchone()

        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        plan = connection.execute(
            "SELECT * FROM day_plans WHERE day_plan_id = ?",
            (task["day_plan_id"],),
        ).fetchone()

        create_activity_log(
            connection=connection,
            day_plan_id=plan["day_plan_id"],
            task_id=task_id,
            event_type="task_deleted",
            result="removed",
            energy_before=plan["remaining_energy"],
            energy_after=plan["remaining_energy"],
            metadata={"task_name": task["name"]},
        )

        connection.execute(
            "DELETE FROM tasks WHERE task_id = ?",
            (task_id,),
        )


@app.get("/api/day-plans/{day_plan_id}/activity-logs")
def get_activity_logs(day_plan_id: str):
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM activity_logs
            WHERE day_plan_id = ?
            ORDER BY created_at ASC
            """,
            (day_plan_id,),
        ).fetchall()

    logs = []

    for row in rows:
        item = dict(row)
        item["metadata_json"] = (
            json.loads(item["metadata_json"])
            if item["metadata_json"]
            else None
        )
        logs.append(item)

    return logs

@app.post("/api/tasks/{task_id}/feedback", status_code=201)
def create_task_feedback(
    task_id: str,
    payload: CreateTaskFeedbackInput,
):
    with get_connection() as connection:
        task = connection.execute(
            "SELECT * FROM tasks WHERE task_id = ?",
            (task_id,),
        ).fetchone()

        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        if task["task_kind"] == "rest":
            raise HTTPException(
                status_code=409,
                detail="Rest tasks do not use task feedback",
            )

        if task["status"] != "done":
            raise HTTPException(
                status_code=409,
                detail="Task must be completed before providing feedback",
            )

        existing_feedback = connection.execute(
            "SELECT feedback_id FROM task_feedbacks WHERE task_id = ?",
            (task_id,),
        ).fetchone()

        if existing_feedback:
            raise HTTPException(
                status_code=409,
                detail="Feedback already exists for this task",
            )

        feedback_id = str(uuid.uuid4())

        connection.execute(
            """
            INSERT INTO task_feedbacks (
                feedback_id,
                task_id,
                actual_duration_minutes,
                perceived_intensity,
                energy_result,
                energy_before,
                energy_after,
                actual_energy_cost
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                feedback_id,
                task_id,
                payload.actual_duration_minutes,
                payload.perceived_intensity,
                payload.energy_result,
                payload.energy_before,
                payload.energy_after,
                payload.actual_energy_cost,
            ),
        )

        feedback = connection.execute(
            "SELECT * FROM task_feedbacks WHERE feedback_id = ?",
            (feedback_id,),
        ).fetchone()

    return dict(feedback)

class MoveTaskInput(BaseModel):
    direction: Literal["up", "down"]


@app.patch("/api/tasks/{task_id}/move")
def move_task(task_id: str, payload: MoveTaskInput):
    with get_connection() as connection:
        task = connection.execute(
            "SELECT * FROM tasks WHERE task_id = ?", (task_id,)
        ).fetchone()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        if task["status"] not in ("pending", "doing"):
            raise HTTPException(status_code=409, detail="Task is no longer active")

        operator = "<" if payload.direction == "up" else ">"
        ordering = "DESC" if payload.direction == "up" else "ASC"
        neighbor = connection.execute(
            f"""
            SELECT task_id, position FROM tasks
            WHERE day_plan_id = ?
              AND status IN ('pending', 'doing')
              AND position {operator} ?
            ORDER BY position {ordering}
            LIMIT 1
            """,
            (task["day_plan_id"], task["position"]),
        ).fetchone()

        if neighbor:
            connection.execute(
                "UPDATE tasks SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?",
                (neighbor["position"], task_id),
            )
            connection.execute(
                "UPDATE tasks SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?",
                (task["position"], neighbor["task_id"]),
            )

    return {"moved": neighbor is not None}