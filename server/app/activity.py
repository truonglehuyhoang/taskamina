import json
import uuid


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
