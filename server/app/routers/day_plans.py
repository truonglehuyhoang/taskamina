import sqlite3
import uuid
from datetime import date

from fastapi import APIRouter, HTTPException, Query, status

from app.database import get_connection
from app.energy import compute_energy_budget
from app.schemas import CreateCheckInInput, CreateDayPlanInput

router = APIRouter(prefix="/api")


@router.get("/day-plans")
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


@router.post("/day-plans", status_code=status.HTTP_201_CREATED)
def create_day_plan(payload: CreateDayPlanInput):
    day_plan_id = str(uuid.uuid4())

    with get_connection() as connection:
        user = connection.execute(
            "SELECT user_id FROM users WHERE user_id = ?",
            (payload.user_id,),
        ).fetchone()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        try:
            connection.execute(
                """
                INSERT INTO day_plans (day_plan_id, user_id, plan_date)
                VALUES (?, ?, ?)
                """,
                (day_plan_id, payload.user_id, payload.plan_date.isoformat()),
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


@router.post("/day-plans/{day_plan_id}/check-ins")
def create_check_in(day_plan_id: str, payload: CreateCheckInInput):
    with get_connection() as connection:
        plan = connection.execute(
            "SELECT * FROM day_plans WHERE day_plan_id = ?",
            (day_plan_id,),
        ).fetchone()

        if not plan:
            raise HTTPException(status_code=404, detail="Day plan not found")

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
