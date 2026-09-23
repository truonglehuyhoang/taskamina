import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardList, CheckCircle, XCircle, AlertTriangle, Coffee, PlusCircle, Trash2, MinusCircle } from "lucide-react";
import { type LogEntry } from "@/lib/activityLog";
import { Button } from "@/components/ui/button";

interface ActivityLogProps {
  logs: LogEntry[];
  onClear: () => void;
}

const resultConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  success: { icon: CheckCircle, color: "text-primary", label: "SUCCESS" },
  strained: { icon: AlertTriangle, color: "text-warning", label: "STRAINED" },
  failed: { icon: XCircle, color: "text-destructive", label: "FAILED" },
  rest: { icon: Coffee, color: "text-accent", label: "RESTED" },
  added: { icon: PlusCircle, color: "text-muted-foreground", label: "ADDED" },
  removed: { icon: MinusCircle, color: "text-muted-foreground", label: "REMOVED" },
};

const ActivityLog = ({ logs, onClear }: ActivityLogProps) => {
  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold tracking-wider text-foreground">
            ACTIVITY LOG
          </h2>
        </div>
        {logs.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive h-7 px-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1 p-4">
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            No activity yet. Start adding tasks!
          </p>
        ) : (
          <div className="space-y-3">
            {[...logs].reverse().map((log) => {
              const cfg = resultConfig[log.result];
              const Icon = cfg.icon;
              return (
                <div
                  key={log.id}
                  className="rounded-md bg-muted p-3 space-y-1.5 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                      <span className={`font-display text-xs tracking-wider ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatTime(log.timestamp)}
                    </span>
                  </div>
                  <p className="text-foreground font-semibold truncate">{log.action}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      ⚡ {log.energyBefore} → {log.energyAfter}
                    </span>
                    <span
                      className={
                        log.energyChange > 0
                          ? "text-primary"
                          : log.energyChange < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {log.energyChange > 0 ? "+" : ""}
                      {log.energyChange}
                    </span>
                    {log.details && <span>• {log.details}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {logs.length > 0 && (
        <div className="border-t border-border p-3 text-xs text-muted-foreground flex justify-between">
          <span>Total: {logs.length} actions</span>
          <span>
            ✅ {logs.filter((l) => l.result === "success").length}{" "}
            ❌ {logs.filter((l) => l.result === "failed").length}{" "}
            💤 {logs.filter((l) => l.result === "rest").length}
          </span>
        </div>
      )}
    </div>
  );
};

export default ActivityLog;
