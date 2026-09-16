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

interface Props {
  dateLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateCheckInInput) => Promise<void>;
}

export default function DailyCheckInDialog({
  dateLabel,
  open,
  onOpenChange,
  onSubmit,
}: Props) {
  const [sleepQuality, setSleepQuality] = useState<CreateCheckInInput["sleep_quality"]>("okay");
  const [moodLevel, setMoodLevel] = useState<CreateCheckInInput["mood_level"]>("neutral");
  const [stressLevel, setStressLevel] = useState<CreateCheckInInput["stress_level"]>("medium");
  const [dayMode, setDayMode] = useState<CreateCheckInInput["day_mode"]>("normal");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const estimate = useMemo(() => {
    let value = 70;
    if (sleepQuality === "good") value += 15;
    if (sleepQuality === "poor") value -= 20;
    if (stressLevel === "high") value -= 15;
    if (dayMode === "focused") value += 10;
    if (dayMode === "survival") value -= 15;
    return Math.max(20, Math.min(100, value));
  }, [sleepQuality, stressLevel, dayMode]);

  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit({
        checkin_type: "morning",
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-widest flex items-center gap-2">
            <BatteryCharging className="h-5 w-5 text-primary" />
            DAILY CHECK-IN
          </DialogTitle>
          <DialogDescription>{dateLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <select value={sleepQuality} onChange={(e) => setSleepQuality(e.target.value as typeof sleepQuality)} className="w-full rounded-lg border border-border bg-muted p-2">
            <option value="poor">Ngủ kém</option>
            <option value="okay">Ngủ bình thường</option>
            <option value="good">Ngủ ngon</option>
          </select>

          <select value={moodLevel} onChange={(e) => setMoodLevel(e.target.value as typeof moodLevel)} className="w-full rounded-lg border border-border bg-muted p-2">
            <option value="low">Mood thấp</option>
            <option value="neutral">Bình thường</option>
            <option value="good">Mood tốt</option>
          </select>

          <select value={stressLevel} onChange={(e) => setStressLevel(e.target.value as typeof stressLevel)} className="w-full rounded-lg border border-border bg-muted p-2">
            <option value="low">Stress thấp</option>
            <option value="medium">Stress vừa</option>
            <option value="high">Stress cao</option>
          </select>

          <select value={dayMode} onChange={(e) => setDayMode(e.target.value as typeof dayMode)} className="w-full rounded-lg border border-border bg-muted p-2">
            <option value="survival">Ngày sinh tồn</option>
            <option value="normal">Ngày bình thường</option>
            <option value="focused">Ngày sung sức</option>
          </select>

          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú ngắn, không bắt buộc" />

          <Button onClick={submit} disabled={saving} className="w-full">
            {saving ? "Creating..." : `START PLAN · ${estimate} ENERGY`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}