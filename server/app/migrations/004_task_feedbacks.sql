CREATE TABLE task_feedbacks (
    feedback_id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL UNIQUE,
    actual_duration_minutes INTEGER NOT NULL
        CHECK(actual_duration_minutes > 0),
    perceived_intensity INTEGER NOT NULL
        CHECK(perceived_intensity BETWEEN 1 AND 3),
    energy_result TEXT NOT NULL
        CHECK(energy_result IN ('lighter', 'as_expected', 'heavier')),
    energy_before INTEGER NOT NULL,
    energy_after INTEGER NOT NULL,
    actual_energy_cost INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (task_id)
        REFERENCES tasks(task_id)
        ON DELETE CASCADE
);