import { Sword, Zap, AlertTriangle, Coffee, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Task } from "@/lib/energy";
import { toast } from "sonner";

interface TaskListProps {
  tasks: Task[];
  energy: number;
  onDoTask: (taskId: string, cost: number, type: "task" | "rest") => Promise<boolean>;
  onDeleteTask: (taskId: string) => void;
}

const TaskList = ({ tasks, energy, onDoTask, onDeleteTask }: TaskListProps) => {
  const riskColor = (r: string) =>
    r === "SAFE"
      ? "text-primary"
      : r === "MODERATE"
      ? "text-warning"
      : "text-destructive";

  const handleDo = async (task: Task) => {
    if (task.type === "rest") {
      await onDoTask(task.id, task.cost, "rest");
      toast.success(`Recovered +${Math.abs(task.cost)} energy`);
      return;
    }

    const success = await onDoTask(task.id, task.cost, "task");

    if (success) {
      toast.success(`"${task.name}" completed!`);
    } else {
      toast.warning(`"${task.name}" done but strained - low energy!`);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg bg-card p-5 border border-border">
        <h2 className="font-display text-lg font-semibold tracking-wider text-foreground mb-3">
          TASKS
        </h2>
        <p className="text-muted-foreground text-sm text-center py-6">
          No tasks yet. Add one above!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-card p-5 border border-border">
      <h2 className="font-display text-lg font-semibold tracking-wider text-foreground mb-3">
        TASKS
      </h2>
      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`rounded-md p-4 flex items-center justify-between gap-4 ${
              task.type === "rest" ? "bg-primary/10 border border-primary/20" : "bg-muted"
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{task.name}</p>
              <div className="flex items-center gap-3 text-xs mt-1">
                {task.type === "rest" ? (
                  <span className="flex items-center gap-1 text-primary">
                    <Zap className="h-3 w-3" /> +{Math.abs(task.cost)}
                  </span>
                ) : (
                  <>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Zap className="h-3 w-3" /> {task.cost}
                    </span>
                    <span className={`flex items-center gap-1 ${riskColor(task.risk)}`}>
                      <AlertTriangle className="h-3 w-3" /> {task.risk}
                    </span>
                  </>
                )}
                <span className="text-muted-foreground">{task.duration} min</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => void handleDo(task)}
                className={
                  task.type === "rest"
                    ? "bg-primary/20 text-primary hover:bg-primary/30 font-display tracking-wider border border-primary/30"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 font-display tracking-wider"
                }
              >
                {task.type === "rest" ? (
                  <><Coffee className="mr-1 h-4 w-4" /> REST</>
                ) : (
                  <><Sword className="mr-1 h-4 w-4" /> DO</>
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onDeleteTask(task.id)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                aria-label="Delete task"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskList;
