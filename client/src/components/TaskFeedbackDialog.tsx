import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  taskName: string;
  estimatedDuration: number;
  estimatedCost: number;
  energyBefore: number;
  energyAfter: number;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    actual_duration_minutes: number;
    perceived_intensity: number;
    energy_result: "lighter" | "as_expected" | "heavier";
  }) => Promise<void>;
}

export default function TaskFeedbackDialog(props: Props) {
  const [duration, setDuration] = useState(props.estimatedDuration);
  const [intensity, setIntensity] = useState(2);
  const [result, setResult] = useState<"lighter" | "as_expected" | "heavier">("as_expected");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await props.onSubmit({
        actual_duration_minutes: duration,
        perceived_intensity: intensity,
        energy_result: result,
      });
      props.onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-widest">TASK FEEDBACK</DialogTitle>
          <DialogDescription>{props.taskName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full rounded-lg border border-border bg-muted p-2">
            {[30, 60, 120, 180].map((value) => <option key={value} value={value}>{value} min thực tế</option>)}
          </select>

          <select value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="w-full rounded-lg border border-border bg-muted p-2">
            <option value={1}>Nhẹ</option>
            <option value={2}>Vừa</option>
            <option value={3}>Nặng</option>
          </select>

          <select value={result} onChange={(e) => setResult(e.target.value as typeof result)} className="w-full rounded-lg border border-border bg-muted p-2">
            <option value="lighter">Nhẹ hơn dự đoán</option>
            <option value="as_expected">Đúng như dự đoán</option>
            <option value="heavier">Mệt hơn dự đoán</option>
          </select>

          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "SAVE FEEDBACK"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}