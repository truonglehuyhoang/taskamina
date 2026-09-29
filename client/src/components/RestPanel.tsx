import { Coffee, Moon, BedDouble } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Task } from "@/lib/energy";

interface RestPanelProps {
  restCount: number;
  onAddRest: (task: Task) => void;
}

const RestPanel = ({ restCount, onAddRest }: RestPanelProps) => {
  const effectiveness = Math.max(50, Math.round((1 - restCount * 0.2) * 100));

  const addRest = (type: "short" | "nap" | "deep") => {
    const config = {
      short: { name: "☕ Short Rest", duration: 15, gain: 10 },
      nap: { name: "🌙 Nap", duration: 30, gain: 20 },
      deep: { name: "🛏️ Deep Rest", duration: 60, gain: 30 },
    };
    const c = config[type];
    const modifier = Math.max(0.5, 1 - restCount * 0.2);
    const gain = Math.round(c.gain * modifier);

    onAddRest({
      id: crypto.randomUUID(),
      name: c.name,
      duration: c.duration,
      intensity: "light",
      cost: -gain, // negative cost = energy gain
      risk: "SAFE",
      type: "rest",
      restType: type,
    });
  };

  return (
    <div className="rounded-lg bg-card p-5 border border-border space-y-4">
      <h2 className="font-display text-lg font-semibold tracking-wider text-foreground">
        REST
      </h2>

      <div className="grid grid-cols-3 gap-3">
        <Button
          variant="outline"
          onClick={() => addRest("short")}
          className="flex-col h-auto py-4 border-border text-foreground hover:bg-muted hover:border-primary/50"
        >
          <Coffee className="h-5 w-5 mb-1 text-primary" />
          <span className="text-xs font-display">SHORT</span>
          <span className="text-xs text-muted-foreground">15-30 min</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => addRest("nap")}
          className="flex-col h-auto py-4 border-border text-foreground hover:bg-muted hover:border-primary/50"
        >
          <Moon className="h-5 w-5 mb-1 text-primary" />
          <span className="text-xs font-display">NAP</span>
          <span className="text-xs text-muted-foreground">30-60 min</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => addRest("deep")}
          className="flex-col h-auto py-4 border-border text-foreground hover:bg-muted hover:border-primary/50"
        >
          <BedDouble className="h-5 w-5 mb-1 text-primary" />
          <span className="text-xs font-display">DEEP</span>
          <span className="text-xs text-muted-foreground">60-90 min</span>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        The next rest is estimated to restore {effectiveness}% of its usual amount.
        {restCount > 0 && " Repeated planned rests have lower estimated recovery."}
      </p>
    </div>
  );
};

export default RestPanel;
