CREATE TABLE tasks (
    task_id TEXT PRIMARY KEY,
    day_plan_id TEXT NOT NULL,
    task_type_id TEXT NOT NULL DEFAULT 'general',
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0),
    intensity_level INTEGER NOT NULL CHECK(intensity_level BETWEEN 1 AND 3),
    estimated_energy_cost INTEGER NOT NULL CHECK(estimated_energy_cost >= 0),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'doing', 'done', 'skipped')),
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (day_plan_id)
        REFERENCES day_plans(day_plan_id)
        ON DELETE CASCADE,

    FOREIGN KEY (task_type_id)
        REFERENCES task_types(task_type_id)
);

CREATE TABLE activity_logs (
    activity_log_id TEXT PRIMARY KEY,
    day_plan_id TEXT NOT NULL,
    task_id TEXT,
    event_type TEXT NOT NULL,
    result TEXT NOT NULL,
    energy_before INTEGER NOT NULL,
    energy_after INTEGER NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (day_plan_id)
        REFERENCES day_plans(day_plan_id)
        ON DELETE CASCADE,

    FOREIGN KEY (task_id)
        REFERENCES tasks(task_id)
        ON DELETE SET NULL
);

CREATE INDEX idx_tasks_day_plan_position
ON tasks(day_plan_id, position);

CREATE INDEX idx_activity_logs_day_plan
ON activity_logs(day_plan_id, created_at);