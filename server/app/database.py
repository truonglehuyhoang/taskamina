import sqlite3
from contextlib import contextmanager
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = SERVER_DIR / "data"
DATABASE_PATH = DATA_DIR / "taskamina.db"
MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


@contextmanager
def get_connection():
    DATA_DIR.mkdir(exist_ok=True)

    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")

    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def run_migrations():
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        applied_versions = {
            row["version"]
            for row in connection.execute(
                "SELECT version FROM schema_migrations"
            ).fetchall()
        }

        for migration_path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            version = migration_path.stem

            if version in applied_versions:
                continue

            sql = migration_path.read_text(encoding="utf-8")
            connection.executescript(sql)
            connection.execute(
                "INSERT INTO schema_migrations(version) VALUES (?)",
                (version,),
            )