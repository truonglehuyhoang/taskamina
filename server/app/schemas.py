from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class CreateDayPlanInput(BaseModel):
    user_id: str
    plan_date: date


class CreateCheckInInput(BaseModel):
    checkin_type: Literal["morning", "midday", "evening", "manual"]
    sleep_quality: Literal["poor", "okay", "good"]
    mood_level: Literal["low", "neutral", "good"]
    stress_level: Literal["low", "medium", "high"]
    day_mode: Literal["survival", "tired", "normal", "focused"]
    note: str | None = Field(default=None, max_length=2000)


class CreateTaskInput(BaseModel):
    task_type_id: str = "general"
    task_kind: Literal["work", "rest"] = "work"
    name: str = Field(min_length=1, max_length=255)
    duration_minutes: int = Field(ge=5, le=720)
    intensity_level: int = Field(ge=1, le=3)
    estimated_energy_cost: int = Field(default=0, ge=0)
    status: Literal["pending"] = "pending"


class UpdateTaskStatusInput(BaseModel):
    status: Literal["doing", "done", "skipped"]


class CreateTaskFeedbackInput(BaseModel):
    actual_duration_minutes: int = Field(gt=0, le=1440)
    perceived_intensity: int = Field(ge=1, le=3)
    energy_result: Literal["lighter", "as_expected", "heavier"]
    energy_before: int = Field(ge=0, le=100)
    energy_after: int = Field(ge=0, le=100)
    actual_energy_cost: int = Field(ge=0, le=100)


class MoveTaskInput(BaseModel):
    direction: Literal["up", "down"]
