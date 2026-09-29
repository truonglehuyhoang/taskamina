import { useState } from "react";
import { Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calcCost, calcRisk, type Task } from "@/lib/energy";

interface AddTaskFormProps {
  energy: number;
  onAdd: (task: Task) => void;
  onPreviewCostChange: (cost: number) => void;
}

const AddTaskForm = ({ energy, onAdd, onPreviewCostChange }: AddTaskFormProps) => {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("60");
  const [intensity, setIntensity] = useState<"light" | "medium" | "heavy">("medium");
  const [preview, setPreview] = useState<{ cost: number; risk: string } | null>(null);
  const isTaskNAmeValid = name.trim().length > 0;
  const durationMinutes = Number(duration);
  const isDurationValid =
    Number.isInteger(durationMinutes) &&
    durationMinutes >= 5 &&
    durationMinutes <= 720;

  const canSubmit = isTaskNAmeValid && isDurationValid;

  const handlePreview = () => {
    if(!canSubmit) {
      return;
    }

    const cost = calcCost(Number(duration), intensity);
    const risk = calcRisk(cost, intensity, energy);
    setPreview({ cost, risk });
    onPreviewCostChange(cost);
  };

  const handleAdd = () => {
    if (!canSubmit) return;
    const cost = calcCost(durationMinutes, intensity);
    const risk = calcRisk(cost, intensity, energy);
    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      duration: durationMinutes,
      intensity,
      cost,
      risk,
      type: "task",
    });
    setName("");
    setPreview(null);
    onPreviewCostChange(0);
  };

  const riskColor = (r: string) =>
    r === "SAFE"
      ? "text-primary"
      : r === "MODERATE"
      ? "text-warning"
      : "text-destructive";

  return (
    <div className="rounded-lg bg-card p-5 border border-border space-y-4">
      <h2 className="font-display text-lg font-semibold tracking-wider text-foreground">
        ADD TASK
      </h2>

      <Input
        placeholder="Task name..."
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          
          if(!e.target.value.trim()){
            setPreview(null);
            onPreviewCostChange(0);
          }
        }} 
        className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground font-display tracking-wider mb-1 block">
            DURATION
          </label>
          <Input
            type="number"
            min={5}
            max={720}
            step={1}
            value={duration}
            onChange={(e) => {
              setDuration(e.target.value);
              setPreview(null);
              onPreviewCostChange(0);
            }}
            className="bg-muted border-border text-foreground"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-display tracking-wider mb-1 block">
            INTENSITY
          </label>
          <Select
              value={intensity}
              onValueChange={(value) => {
                setIntensity(value as Task["intensity"]);
                setPreview(null);
                onPreviewCostChange(0);
            }}>
            <SelectTrigger className="bg-muted border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">🟢 Light</SelectItem>
              <SelectItem value="medium">🟡 Medium</SelectItem>
              <SelectItem value="heavy">🔴 Heavy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {preview && (
        <div className="rounded-md bg-muted p-3 text-sm font-body">
          <span className="text-foreground">⚡ Cost: {preview.cost}</span>
          <span className="mx-3">|</span>
          <span className={riskColor(preview.risk)}>⚠️ Risk: {preview.risk}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button 
          variant="outline" 
          onClick={handlePreview} 
          disabled={!canSubmit}
          className="border-border text-foreground hover:bg-muted">
          <Eye className="mr-2 h-4 w-4" /> Preview
        </Button>
        <Button 
          onClick={handleAdd} 
          disabled={!canSubmit}
          className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Add Task
        </Button>
      </div>
    </div>
  );
};

export default AddTaskForm;
