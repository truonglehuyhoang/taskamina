import uuid

from fastapi import APIRouter, HTTPException

from app.activity import create_activity_log
from app.database import get_connection
from app.energy import compute_rest_gain, compute_task_cost
from app.schemas import (
    CreateTaskFeedbackInput,
    CreateTaskInput,
    MoveTaskInput,
    UpdateTaskStatusInput,
)

router = APIRouter(prefix="/api")


@router.get("/day-plans/{day_plan_id}/tasks")
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


@router.post("/day-plans/{day_plan_id}/tasks", status_code=201)
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


@router.patch("/tasks/{task_id}")
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


@router.delete("/tasks/{task_id}", status_code=204)
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

        connection.execute("DELETE FROM tasks WHERE task_id = ?", (task_id,))


@router.post("/tasks/{task_id}/feedback", status_code=201)
def create_task_feedback(task_id: str, payload: CreateTaskFeedbackInput):
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


@router.patch("/tasks/{task_id}/move")
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
