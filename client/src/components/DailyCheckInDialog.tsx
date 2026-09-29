import { useMemo, useState } from "react";
import { BatteryCharging } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CreateCheckInInput } from "@/types/planning";
import { format } from "date-fns";

interface Props {
  dateLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateCheckInInput) => Promise<void>;
  planDate: string;
}

export default function DailyCheckInDialog({
  dateLabel,
  open,
  onOpenChange,
  onSubmit,
  planDate,
}: Props) {
  const [sleepQuality, setSleepQuality] = useState<CreateCheckInInput["sleep_quality"]>("okay");
  const [moodLevel, setMoodLevel] = useState<CreateCheckInInput["mood_level"]>("neutral");
  const [stressLevel, setStressLevel] = useState<CreateCheckInInput["stress_level"]>("medium");
  const [dayMode, setDayMode] = useState<CreateCheckInInput["day_mode"]>("normal");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const energyBudgetByMode = {
    survival: 40,
    tired: 60,
    normal: 80,
    focused: 100,
  } as const;

  const estimate = energyBudgetByMode[dayMode];

  const submit = async () => {
    setSaving(true);
    const now = new Date();
    const isToday = planDate === format(now, "yyyy-MM-dd");
    const hour = now.getHours();

    const checkinType: CreateCheckInInput["checkin_type"] = !isToday
      ? "manual"
      : hour < 12
        ? "morning"
        : hour < 18
          ? "midday"
          : "evening";
    try {
      await onSubmit({
        checkin_type: checkinType,
        sleep_quality: sleepQuality,
        mood_level: moodLevel,
        stress_level: stressLevel,
        day_mode: dayMode,
        note: note.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-widest flex items-center gap-2">
            <BatteryCharging className="h-5 w-5 text-primary" />
            DAILY CHECK-IN
          </DialogTitle>
          <DialogDescription>{dateLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="sleep-quality" className="block text-sm text-foreground">
              How well did you sleep last night?
            </label>
            <select id="sleep-quality" value={sleepQuality}
              onChange={(e) => setSleepQuality(e.target.value as typeof sleepQuality)}
              className="w-full rounded-lg border border-border bg-muted p-2">
              <option value="poor">Poor sleep</option>
              <option value="okay">Normal sleep</option>
              <option value="good">Good sleep</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="mood-level" className="block text-sm text-foreground">
              How is your mood right now?
            </label>
            <select id="mood-level" value={moodLevel}
              onChange={(e) => setMoodLevel(e.target.value as typeof moodLevel)}
              className="w-full rounded-lg border border-border bg-muted p-2">
              <option value="low">Low mood</option>
              <option value="neutral">Neutral</option>
              <option value="good">Good mood</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="stress-level" className="block text-sm text-foreground">
              How stressed do you feel right now?
            </label>
            <select id="stress-level" value={stressLevel}
              onChange={(e) => setStressLevel(e.target.value as typeof stressLevel)}
              className="w-full rounded-lg border border-border bg-muted p-2">
              <option value="low">Low stress</option>
              <option value="medium">Moderate stress</option>
              <option value="high">High stress</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="day-mode" className="block text-sm text-foreground">
              How much energy do you feel you have today?
            </label>
            <select id="day-mode" value={dayMode}
              onChange={(e) => setDayMode(e.target.value as typeof dayMode)}
              className="w-full rounded-lg border border-border bg-muted p-2">
              <option value="survival">Very tired</option>
              <option value="tired">Low energy</option>
              <option value="normal">Normal</option>
              <option value="focused">Energized</option>
            </select>
          </div>

          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />

          <Button onClick={submit} disabled={saving} className="w-full">
            {saving ? "Creating..." : `START PLAN · ${estimate} ENERGY`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}