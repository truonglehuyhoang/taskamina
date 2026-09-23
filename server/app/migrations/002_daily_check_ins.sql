CREATE TABLE daily_check_ins (
    checkin_id TEXT PRIMARY KEY,
    day_plan_id TEXT NOT NULL,
    checkin_type TEXT NOT NULL,
    sleep_quality TEXT NOT NULL,
    mood_level TEXT NOT NULL,
    stress_level TEXT NOT NULL,
    day_mode TEXT NOT NULL,
    computed_energy_budget INTEGER NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (day_plan_id)
        REFERENCES day_plans(day_plan_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_daily_check_ins_day_plan
ON daily_check_ins(day_plan_id, created_at);