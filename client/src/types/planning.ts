export type CheckInType = "morning" | "midday" | "evening" | "manual";
export type TaskStatus = "pending" | "doing" | "done" | "skipped";

export interface ApiDayPlan {
  day_plan_id: string;
  user_id: string;
  plan_date: string;
  start_time_minutes: number | null;
  end_time_minutes: number | null;
  energy_budget: number;
  remaining_energy: number;
  created_at: string;
  updated_at: string;
}

export interface ApiTask {
  task_id: string;
  day_plan_id: string;
  task_type_id: string;
  name: string;
  duration_minutes: number;
  intensity_level: number;
  estimated_energy_cost: number;
  status: TaskStatus;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ApiActivityLog {
  activity_log_id: string;
  day_plan_id: string;
  task_id: string | null;
  event_type: string;
  result: string;
  energy_before: number;
  energy_after: number;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateCheckInInput {
  checkin_type: CheckInType;
  sleep_quality: "poor" | "okay" | "good";
  mood_level: "low" | "neutral" | "good";
  stress_level: "low" | "medium" | "high";
  day_mode: "survival" | "normal" | "focused";
  note?: string;
}