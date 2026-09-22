import axios from "axios";
import type {
  ApiActivityLog,
  ApiDayPlan,
  ApiTask,
  CreateCheckInInput,
} from "@/types/planning";

const api = axios.create({
  baseURL: "http://127.0.0.1:8080/api",
});

export const DEFAULT_USER_ID = "local-user";

export async function getDayPlan(planDate: string) {
  const response = await api.get<ApiDayPlan | null>("/day-plans", {
    params: { user_id: DEFAULT_USER_ID, plan_date: planDate },
  });
  return response.data;
}

export async function createDayPlan(planDate: string) {
  const response = await api.post<ApiDayPlan>("/day-plans", {
    user_id: DEFAULT_USER_ID,
    plan_date: planDate,
  });
  return response.data;
}

export async function createCheckIn(dayPlanId: string, input: CreateCheckInInput) {
  const response = await api.post<ApiDayPlan>(`/day-plans/${dayPlanId}/check-ins`, input);
  return response.data;
}

export async function getTasks(dayPlanId: string) {
  const response = await api.get<ApiTask[]>(`/day-plans/${dayPlanId}/tasks`);
  return response.data;
}

export async function createTask(
  dayPlanId: string,
  input: Omit<ApiTask, "task_id" | "day_plan_id" | "created_at" | "updated_at" | "position">,
) {
  const response = await api.post<ApiTask>(`/day-plans/${dayPlanId}/tasks`, input);
  return response.data;
}

export async function updateTaskStatus(taskId: string, status: "doing" | "done" | "skipped") {
  const response = await api.patch<ApiDayPlan>(`/tasks/${taskId}`, { status });
  return response.data;
}

export async function deleteTask(taskId: string) {
  await api.delete(`/tasks/${taskId}`);
}

export async function createTaskFeedback(
  taskId: string,
  input: {
    actual_duration_minutes: number;
    perceived_intensity: number;
    energy_result: "lighter" | "as_expected" | "heavier";
    energy_before: number;
    energy_after: number;
    actual_energy_cost: number;
  },
) {
  await api.post(`/tasks/${taskId}/feedback`, input);
}

export async function recordRest(dayPlanId: string, durationMinutes: number, requestedGain: number) {
  const response = await api.post<ApiDayPlan>(`/day-plans/${dayPlanId}/rests`, {
    duration_minutes: durationMinutes,
    requested_energy_gain: requestedGain,
  });
  return response.data;
}

export async function getActivityLogs(dayPlanId: string) {
  const response = await api.get<ApiActivityLog[]>(`/day-plans/${dayPlanId}/activity-logs`);
  return response.data;
}