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
  recordRest,
  updateTaskStatus,
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
  cost: task.estimated_energy_cost,
  risk: "SAFE",
  type: "task",
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
      setRestCount(
        serverLogs.filter((item) => item.event_type === "rest_completed").length,
      );
      setCheckInOpen(false);
    } catch {
      toast.error("Không thể tải kế hoạch trong ngày.");
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

      toast.success("Energy plan đã được tạo.");
      await loadPlan(selectedDate);
    } catch {
      toast.error("Không thể tạo energy plan.");
      throw new Error("Failed to create daily plan");
    }
  };

  const handleAddTask = async (task: Task) => {
    if (!dayPlan) {
      toast.warning("Hãy check-in trước khi thêm task.");
      return;
    }

    if (task.type === "rest") {
      try {
        await recordRest(
          dayPlan.day_plan_id,
          task.duration,
          Math.abs(task.cost),
        );

        toast.success(`Recovered +${Math.abs(task.cost)} energy`);
        await loadPlan(selectedDate);
      } catch {
        toast.error("Không thể ghi nhận thời gian nghỉ.");
      }

      return;
    }

    try {
      await createTask(dayPlan.day_plan_id, {
        task_type_id: "general",
        name: task.name,
        duration_minutes: task.duration,
        intensity_level:
          task.intensity === "light"
            ? 1
            : task.intensity === "heavy"
              ? 3
              : 2,
        estimated_energy_cost: task.cost,
        status: "pending",
      });

      toast.success("Task added.");
      await loadPlan(selectedDate);
    } catch {
      toast.error("Không thể thêm task.");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      await loadPlan(selectedDate);
      toast.success("Task removed.");
    } catch {
      toast.error("Không thể xóa task.");
    }
  };

  const handleDoTask = async (
    taskId: string,
    cost: number,
    type: "task" | "rest",
  ) => {
    if (!dayPlan) return false;

    if (type === "rest") {
      return true;
    }

    const task = tasks.find((item) => item.task_id === taskId);

    if (!task) {
      toast.error("Không tìm thấy task.");
      return false;
    }

    try {
      const energyBefore = dayPlan.remaining_energy;
      const updatedPlan = await updateTaskStatus(taskId, "done");

      setFeedback({
        task,
        energyBefore,
        energyAfter: updatedPlan.remaining_energy,
      });

      await loadPlan(selectedDate);

      return energyBefore >= cost;
    } catch {
      toast.error("Không thể hoàn thành task.");
      return false;
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
      toast.error("Không thể lưu feedback.");
      throw new Error("Failed to save task feedback");
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
              pendingCost={visibleTasks.reduce(
                (sum, task) => sum + task.cost,
                0,
              )}
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
            />

            <RestPanel
              restCount={restCount}
              onAddRest={handleAddTask}
            />
          </div>

          <div className="lg:sticky lg:top-8 lg:h-[calc(100vh-8rem)]">
            <ActivityLog
              logs={logs}
              onClear={() =>
                toast.info("Activity log được lưu làm lịch sử và không thể xóa.")
              }
            />
          </div>
        </div>

        {loading && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Loading plan...
          </p>
        )}
      </div>

      <DailyCheckInDialog
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
        dateLabel={format(selectedDate, "EEEE, MMMM d")}
        onSubmit={handleCreatePlan}
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