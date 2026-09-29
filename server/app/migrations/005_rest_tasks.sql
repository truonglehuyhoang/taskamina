ALTER TABLE tasks
ADD COLUMN task_kind TEXT NOT NULL DEFAULT 'work'
CHECK (task_kind IN ('work', 'rest'));

ALTER TABLE tasks
ADD COLUMN estimated_recovery_gain INTEGER NOT NULL DEFAULT 0
CHECK (estimated_recovery_gain >= 0);

INSERT OR IGNORE INTO task_types (
    task_type_id, name, default_energy_multiplier, is_default
)
VALUES ('rest', 'Rest', 1, 0);