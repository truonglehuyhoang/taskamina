import { useCallback, useEffect, useMemo, useState } from "react";
import { format, startOfDay } from "date-fns";
import { CalendarIcon, Zap } from "lucide-react";
import { toast } from "sonner";

import EnergyBar from "@/components/EnergyBar";
import AddTaskForm from "@/components/AddTaskForm";
import TaskList from "@/components/TaskList";
import RestPanel from "@/components/RestPanel";
import ActivityLog from "@/components/ActivityLog";
import DailyCheckInDialog from "@/components/DailyCheckInDialog";
import TaskFeedbackDialog from "@/components/TaskFeedbackDialog";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { Task } from "@/lib/energy";
import type { LogEntry } from "@/lib/activityLog";
import type {
  ApiActivityLog,
  ApiDayPlan,
  ApiTask,
  CreateCheckInInput,
} from "@/types/planning";

import {
  createCheckIn,
  createDayPlan,
  createTask,
  createTaskFeedback,
  deleteTask,
  getActivityLogs,
  getDayPlan,
  getTasks,
  updateTaskStatus,
  moveTask,
} from "@/lib/api";

const today = () => startOfDay(new Date());

const mapLogResult = (
  result: string,
): LogEntry["result"] => {
  if (result === "rest") return "rest";
  if (result === "strained") return "strained";
  if (result === "failed" || result === "skipped") return "failed";
  if (result === "added") return "added";
  if (result === "removed") return "removed";

  return "success";
};

const mapActivityLog = (item: ApiActivityLog): LogEntry => ({
  id: item.activity_log_id,
  timestamp: new Date(item.created_at),
  action:
    typeof item.metadata_json?.task_name === "string"
      ? item.metadata_json.task_name
      : item.event_type.replaceAll("_", " "),
  energyBefore: item.energy_before,
  energyAfter: item.energy_after,
  energyChange: item.energy_after - item.energy_before,
  result: mapLogResult(item.result),
  details: item.event_type.replaceAll("_", " "),
});

const mapApiTaskToUiTask = (task: ApiTask): Task => ({
  id: task.task_id,
  name: task.name,
  duration: task.duration_minutes,
  intensity:
    task.intensity_level === 1
      ? "light"
      : task.intensity_level === 3
        ? "heavy"
        : "medium",
  cost:
    task.task_kind === "rest"
      ? -task.estimated_recovery_gain
      : task.estimated_energy_cost,
  risk: "SAFE",
  type: task.task_kind === "rest" ? "rest" : "task",
});

const Index = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(today());
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [dayPlan, setDayPlan] = useState<ApiDayPlan | null>(null);
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [restCount, setRestCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [previewCost, setPreviewCost] = useState(0);
  const [previewEnabled, setPreviewEnabled] = useState(false);

  const [feedback, setFeedback] = useState<{
    task: ApiTask;
    energyBefore: number;
    energyAfter: number;
  } | null>(null);

  const loadPlan = useCallback(async (date: Date) => {
    setLoading(true);

    try {
      const plan = await getDayPlan(format(date, "yyyy-MM-dd"));

      if (!plan) {
        setDayPlan(null);
        setTasks([]);
        setLogs([]);
        setRestCount(0);
        setCheckInOpen(true);
        return;
      }

      const [serverTasks, serverLogs] = await Promise.all([
        getTasks(plan.day_plan_id),
        getActivityLogs(plan.day_plan_id),
      ]);

      setDayPlan(plan);
      setTasks(serverTasks);
      setLogs(serverLogs.map(mapActivityLog));
      setRestCount(serverTasks.filter((task) => task.task_kind === "rest").length);
      setCheckInOpen(false);
    } catch {
      toast.error("Could not load the daily plan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlan(selectedDate);
  }, [loadPlan, selectedDate]);

  const visibleTasks = useMemo(
    () =>
      tasks
        .filter(
          (task) => task.status === "pending" || task.status === "doing",
        )
        .sort((a, b) => a.position - b.position)
        .map(mapApiTaskToUiTask),
    [tasks],
  );

  const currentEnergy = dayPlan?.remaining_energy ?? 0;
  const maxEnergy = dayPlan?.energy_budget ?? 100;

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;

    setCalendarOpen(false);
    setSelectedDate(date);
    setPreviewCost(0);
  };

  const handleCreatePlan = async (input: CreateCheckInInput) => {
    try {
      let plan = await getDayPlan(format(selectedDate, "yyyy-MM-dd"));

      if (!plan) {
        plan = await createDayPlan(format(selectedDate, "yyyy-MM-dd"));
      }

      await createCheckIn(plan.day_plan_id, input);

      toast.success("Daily plan created.");
      await loadPlan(selectedDate);
    } catch {
      toast.error("Could not create the daily plan.");
      throw new Error("Failed to create daily plan");
    }
  };

  const handleAddTask = async (task: Task) => {
    if (!dayPlan) {
      toast.warning("Check in before adding a task.");
      return;
    }

    try {
      await createTask(dayPlan.day_plan_id, {
        task_type_id: task.type === "rest" ? "rest" : "general",
        task_kind: task.type === "rest" ? "rest" : "work",
        name: task.name,
        duration_minutes: task.duration,
        intensity_level:
          task.type === "rest" || task.intensity === "light"
            ? 1
            : task.intensity === "heavy"
              ? 3
              : 2,
        estimated_energy_cost: task.type === "rest" ? 0 : task.cost,
        estimated_recovery_gain: task.type === "rest" ? Math.abs(task.cost) : 0,
        status: "pending",
      });

      toast.success(task.type === "rest" ? "Rest added to your plan." : "Task added.");
      await loadPlan(selectedDate);
    } catch {
      toast.error(task.type === "rest" ? "Could not add rest." : "Could not add the task.");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      await loadPlan(selectedDate);
      toast.success("Task removed.");
    } catch {
      toast.error("Could not delete the task.");
    }
  };

  const handleDoTask = async (
    taskId: string,
    cost: number,
    type: "task" | "rest",
  ): Promise<boolean | null> => {
    if (!dayPlan) return null;

    const task = tasks.find((item) => item.task_id === taskId);
    if (!task) {
      toast.error("Task not found.");
      return null;
    }

    try {
      const energyBefore = dayPlan.remaining_energy;
      const updatedPlan = await updateTaskStatus(taskId, "done");

      if (type === "rest") {
        const recovered = updatedPlan.remaining_energy - energyBefore;
        toast.success(`Rest finished. Recovered ${recovered} energy.`);
      } else {
        setFeedback({
          task,
          energyBefore,
          energyAfter: updatedPlan.remaining_energy,
        });
      }

      await loadPlan(selectedDate);
      return type === "rest" || energyBefore >= cost;
    } catch {
      toast.error(type === "rest" ? "Could not finish rest." : "Could not complete the task.");
      return null;
    }
  };

  const handleFeedbackSubmit = async (input: {
    actual_duration_minutes: number;
    perceived_intensity: number;
    energy_result: "lighter" | "as_expected" | "heavier";
  }) => {
    if (!feedback) return;

    try {
      await createTaskFeedback(feedback.task.task_id, {
        ...input,
        energy_before: feedback.energyBefore,
        energy_after: feedback.energyAfter,
        actual_energy_cost:
          feedback.energyBefore - feedback.energyAfter,
      });

      toast.success("Feedback saved.");
      setFeedback(null);
    } catch {
      toast.error("Could not save feedback.");
      throw new Error("Failed to save task feedback");
    }
  };

  const handleMoveTask = async (taskId: string, direction: "up" | "down") => {
    try {
      await moveTask(taskId, direction);
      await loadPlan(selectedDate);
    } catch {
      toast.error("Could not reorder the task.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className="h-7 w-7 animate-pulse-glow rounded-full text-primary" />
            <h1 className="font-display text-2xl font-bold tracking-widest text-foreground">
              TASKAMINA: ENERGY-BASED TASK PLANNER
            </h1>
          </div>

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "border-border font-display tracking-wider text-foreground hover:bg-muted",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                {format(selectedDate, "EEE, MMM d, yyyy")}
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleCalendarSelect}
                disabled={(date) => startOfDay(date) < today()}
                className="pointer-events-auto p-3"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <EnergyBar
              energy={currentEnergy}
              maxEnergy={maxEnergy}
              previewCost={previewCost}
              plannedTasks={visibleTasks}
              previewEnabled={previewEnabled}
              onPreviewEnabledChange={setPreviewEnabled}
            />

            <AddTaskForm
              energy={currentEnergy}
              onAdd={handleAddTask}
              onPreviewCostChange={setPreviewCost}
            />

            <TaskList
              tasks={visibleTasks}
              energy={currentEnergy}
              onDoTask={handleDoTask}
              onDeleteTask={handleDeleteTask}
              onMoveTask={handleMoveTask}
            />

            <RestPanel
              restCount={restCount}
              onAddRest={handleAddTask}
            />
          </div>

          <div className="h-[min(560px,calc(100vh-2rem))] lg:sticky lg:top-8 lg:h-[calc(100vh-8rem)]">
            <ActivityLog
              logs={logs}
              onClear={() =>
                toast.info("Activity log has been saved as history and cannot be deleted.")
              }
            />
          </div>
        </div>

        {loading && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Loading plans...
          </p>
        )}
      </div>

      <DailyCheckInDialog
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
        dateLabel={format(selectedDate, "EEEE, MMMM d")}
        onSubmit={handleCreatePlan}
        planDate={format(selectedDate, "yyyy-MM-dd")}
      />

      <TaskFeedbackDialog
        open={Boolean(feedback)}
        onOpenChange={(open) => {
          if (!open) setFeedback(null);
        }}
        taskName={feedback?.task.name ?? ""}
        estimatedDuration={feedback?.task.duration_minutes ?? 60}
        estimatedCost={feedback?.task.estimated_energy_cost ?? 0}
        energyBefore={feedback?.energyBefore ?? 0}
        energyAfter={feedback?.energyAfter ?? 0}
        onSubmit={handleFeedbackSubmit}
      />
    </div>
  );
};

export default Index;