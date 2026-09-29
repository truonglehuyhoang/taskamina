CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_types (
    task_type_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    default_energy_multiplier REAL NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE day_plans (
    day_plan_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_date TEXT NOT NULL,
    start_time_minutes INTEGER,
    end_time_minutes INTEGER,
    energy_budget INTEGER NOT NULL DEFAULT 0,
    remaining_energy INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id),
    UNIQUE (user_id, plan_date)
);

INSERT OR IGNORE INTO users (user_id, name)
VALUES ('local-user', 'Local user');

INSERT OR IGNORE INTO task_types (
    task_type_id,
    name,
    default_energy_multiplier,
    is_default
)
VALUES ('general', 'General', 1, 1);