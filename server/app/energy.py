import math

from app.schemas import CreateCheckInInput


def compute_rest_gain(duration_minutes: int, previous_rest_count: int) -> int:
    base_gain = {15: 10, 30: 20, 60: 30}[duration_minutes]
    effectiveness = max(0.5, 1 - previous_rest_count * 0.2)
    return math.floor(base_gain * effectiveness + 0.5)


def compute_energy_budget(payload: CreateCheckInInput) -> int:
    budgets = {
        "survival": 40,
        "tired": 60,
        "normal": 80,
        "focused": 100,
    }
    return budgets[payload.day_mode]


def compute_task_cost(duration_minutes: int, intensity_level: int) -> int:
    multipliers = {1: 0.8, 2: 1.0, 3: 1.3}
    base_cost = (
        duration_minutes / 3
        if duration_minutes <= 60
        else 20 + (duration_minutes - 60) * 0.25
    )
    return math.floor(base_cost * multipliers[intensity_level] + 0.5)
