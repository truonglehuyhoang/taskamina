import json

from fastapi import APIRouter

from app.database import get_connection

from datetime import datetime, timezone

router = APIRouter(prefix="/api")


@router.get("/day-plans/{day_plan_id}/activity-logs")
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
        created_at = datetime.fromisoformat(item["created_at"])
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        item["created_at"] = created_at.isoformat()
        item["metadata_json"] = (
            json.loads(item["metadata_json"])
            if item["metadata_json"]
            else None
        )
        logs.append(item)

    return logs
