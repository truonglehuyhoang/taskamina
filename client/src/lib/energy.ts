export interface Task {
  id: string;
  name: string;
  duration: number;
  intensity: "light" | "medium" | "heavy";
  cost: number;
  risk: string;
  type: "task" | "rest";
  restType?: "short" | "nap" | "deep";
}

const intensityMultiplier = {
  light: 0.8,
  medium: 1,
  heavy: 1.3,
} as const;

export function calcCost(
  durationMinutes: number,
  intensity: Task["intensity"],
): number {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 720) {
    throw new Error("Duration must be between 5 and 720 minutes");
  }

  const baseCost =
    durationMinutes <= 60
      ? durationMinutes / 3
      : 20 + (durationMinutes - 60) * 0.25;

  return Math.round(baseCost * intensityMultiplier[intensity]);
}

export function calcRisk(
  cost: number,
  _intensity: Task["intensity"],
  remainingEnergy: number,
): string {
  if (remainingEnergy <= 0 || cost > remainingEnergy) return "HIGH";
  if (cost >= remainingEnergy * 0.5) return "MODERATE";
  return "SAFE";
}
