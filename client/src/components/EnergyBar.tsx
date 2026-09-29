import { Zap, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { Task } from "@/lib/energy";

interface EnergyBarProps {
  energy: number;
  maxEnergy: number;
  previewCost?: number;
  plannedTasks?: Task[];
  previewEnabled: boolean;
  onPreviewEnabledChange: (value: boolean) => void;
}

const EnergyBar = ({
  energy,
  maxEnergy,
  previewCost = 0,
  plannedTasks = [],
  previewEnabled,
  onPreviewEnabledChange,
}: EnergyBarProps) => {
  const percent =
    maxEnergy > 0 ? Math.round((energy / maxEnergy) * 100) : 0;

  const showProjection =
    previewEnabled && (plannedTasks.length > 0 || previewCost !== 0);

  // Preview tasks in their displayed order. Rest gains are capped at maxEnergy.
  const plannedEnergy = plannedTasks.reduce(
    (current, task) =>
      Math.max(0, Math.min(maxEnergy, current - task.cost)),
    energy,
  );

  // previewCost is the work task currently being entered in AddTaskForm.
  const projectedEnergy = showProjection
    ? Math.max(0, Math.min(maxEnergy, plannedEnergy - previewCost))
    : energy;

  const projectedPercent =
    maxEnergy > 0
      ? Math.round((projectedEnergy / maxEnergy) * 100)
      : 0;

  const isNetGain = projectedEnergy > energy;

  const barColor =
    percent > 60
      ? "bg-primary"
      : percent > 30
        ? "bg-warning"
        : "bg-destructive";

  const glowColor =
    percent > 60
      ? "shadow-[0_0_12px_hsl(var(--primary)/0.5)]"
      : percent > 30
        ? "shadow-[0_0_12px_hsl(var(--warning)/0.5)]"
        : "shadow-[0_0_12px_hsl(var(--destructive)/0.5)]";

  return (
    <div className="rounded-lg bg-card p-5 border border-border">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold tracking-wider text-foreground">
            ENERGY
          </h2>
        </div>

        <label className="flex cursor-pointer select-none items-center gap-2">
          {previewEnabled ? (
            <Eye className="h-4 w-4 text-primary" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-display text-xs tracking-wider text-muted-foreground">
            PREVIEW
          </span>
          <Switch
            checked={previewEnabled}
            onCheckedChange={onPreviewEnabledChange}
          />
        </label>
      </div>

      <div
        className={`relative h-6 overflow-hidden rounded-full bg-muted ${glowColor}`}
      >
        {showProjection && !isNetGain && (
          <div
            className="absolute h-full rounded-full bg-destructive/30 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        )}

        {showProjection && isNetGain && (
          <div
            className="absolute h-full rounded-full bg-primary/25 transition-all duration-300"
            style={{ width: `${projectedPercent}%` }}
          />
        )}

        <div
          className={`relative h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{
            width: `${
              showProjection && !isNetGain
                ? projectedPercent
                : percent
            }%`,
          }}
        />
      </div>

      <p className="mt-2 text-center font-display text-sm tracking-widest text-muted-foreground">
        {Math.round(energy)} / {maxEnergy}
        {showProjection && (
          <span
            className={
              isNetGain
                ? "ml-2 text-primary"
                : "ml-2 text-destructive"
            }
          >
            → {Math.round(projectedEnergy)}
          </span>
        )}
      </p>

      {showProjection && (
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Estimate in the displayed task order. Rest restores energy only
          when finished.
        </p>
      )}
    </div>
  );
};

export default EnergyBar;