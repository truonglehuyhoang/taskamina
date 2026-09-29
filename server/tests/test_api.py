import sys
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

from app import database  # noqa: E402
from main import app  # noqa: E402


class ApiSmokeTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_data_dir = database.DATA_DIR
        self.original_database_path = database.DATABASE_PATH
        database.DATA_DIR = Path(self.temp_dir.name)
        database.DATABASE_PATH = database.DATA_DIR / "taskamina.db"
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        database.DATA_DIR = self.original_data_dir
        database.DATABASE_PATH = self.original_database_path
        self.temp_dir.cleanup()

    def test_plan_task_rest_feedback_and_logs(self):
        self.assertEqual(self.client.get("/api/health").json(), {"status": "ok"})

        plan_response = self.client.post(
            "/api/day-plans",
            json={"user_id": "local-user", "plan_date": "2030-01-01"},
        )
        self.assertEqual(plan_response.status_code, 201)
        plan_id = plan_response.json()["day_plan_id"]

        check_in = {
            "checkin_type": "evening",
            "sleep_quality": "good",
            "mood_level": "good",
            "stress_level": "low",
            "day_mode": "normal",
        }
        response = self.client.post(
            f"/api/day-plans/{plan_id}/check-ins", json=check_in
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["remaining_energy"], 80)

        later_check_in = {**check_in, "checkin_type": "midday", "day_mode": "tired"}
        response = self.client.post(
            f"/api/day-plans/{plan_id}/check-ins", json=later_check_in
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["remaining_energy"], 80)

        work_response = self.client.post(
            f"/api/day-plans/{plan_id}/tasks",
            json={
                "task_kind": "work",
                "name": "Write report",
                "duration_minutes": 60,
                "intensity_level": 2,
            },
        )
        self.assertEqual(work_response.status_code, 201)
        work = work_response.json()
        self.assertEqual(work["estimated_energy_cost"], 20)

        rest_response = self.client.post(
            f"/api/day-plans/{plan_id}/tasks",
            json={
                "task_kind": "rest",
                "name": "Short rest",
                "duration_minutes": 15,
                "intensity_level": 1,
            },
        )
        self.assertEqual(rest_response.status_code, 201)
        rest = rest_response.json()
        self.assertEqual(rest["estimated_recovery_gain"], 10)

        response = self.client.get(
            "/api/day-plans",
            params={"user_id": "local-user", "plan_date": "2030-01-01"},
        )
        self.assertEqual(response.json()["remaining_energy"], 80)

        response = self.client.patch(
            f"/api/tasks/{rest['task_id']}/move", json={"direction": "up"}
        )
        self.assertEqual(response.json(), {"moved": True})
        tasks = self.client.get(f"/api/day-plans/{plan_id}/tasks").json()
        self.assertEqual([task["task_id"] for task in tasks], [rest["task_id"], work["task_id"]])

        response = self.client.patch(
            f"/api/tasks/{work['task_id']}", json={"status": "done"}
        )
        self.assertEqual(response.json()["remaining_energy"], 60)

        feedback = self.client.post(
            f"/api/tasks/{work['task_id']}/feedback",
            json={
                "actual_duration_minutes": 60,
                "perceived_intensity": 2,
                "energy_result": "as_expected",
                "energy_before": 80,
                "energy_after": 60,
                "actual_energy_cost": 20,
            },
        )
        self.assertEqual(feedback.status_code, 201)

        response = self.client.patch(
            f"/api/tasks/{rest['task_id']}", json={"status": "done"}
        )
        self.assertEqual(response.json()["remaining_energy"], 70)

        logs = self.client.get(f"/api/day-plans/{plan_id}/activity-logs").json()
        self.assertEqual(
            [log["event_type"] for log in logs].count("rest_completed"), 1
        )
        rest_log = next(log for log in logs if log["event_type"] == "rest_completed")
        self.assertEqual(rest_log["task_id"], rest["task_id"])
        self.assertEqual(rest_log["metadata_json"]["energy_change"], 10)

        response = self.client.delete(f"/api/tasks/{work['task_id']}")
        self.assertEqual(response.status_code, 204)
        logs = self.client.get(f"/api/day-plans/{plan_id}/activity-logs").json()
        deleted_work_log = next(
            log for log in logs if log["event_type"] == "task_completed"
        )
        self.assertIsNone(deleted_work_log["task_id"])


if __name__ == "__main__":
    unittest.main()
