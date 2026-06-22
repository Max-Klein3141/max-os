import type { ComponentType } from "react";
import { cn } from "../../lib/cn";

interface LevelSliderProps {
  label: string;
  value?: number; // 1–5, undefined = not logged
  onChange: (value: number) => void;
  yesterday?: number;
  icon: ComponentType<{ size?: number; className?: string }>;
  accent: string;
}

/** A labelled 1–5 slider used for energy / sleep / stress. */
export function LevelSlider({
  label,
  value,
  onChange,
  yesterday,
  icon: Icon,
  accent,
}: LevelSliderProps) {
  // Unrated until the user explicitly moves the slider: it sits at the midpoint
  // (3) purely as a placeholder, but nothing is saved to the log until then, so
  // "untouched" stays distinguishable from a deliberate score of 3.
  const rated = value !== undefined;
  const display = value ?? 3;
  const fill = ((display - 1) / 4) * 100;
  const track = rated ? accent : "#3f3f46"; // zinc-700 when unrated

  return (
    <div
      className={cn(
        "rounded-lg border bg-zinc-900/40 p-4 transition-colors",
        rated ? "border-zinc-800" : "border-dashed border-zinc-700",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-300">
          <Icon size={15} className="text-zinc-500" />
          {label}
        </span>
        <span
          className="text-lg font-semibold tabular-nums"
          style={{ color: rated ? accent : "#52525b" }}
        >
          {value ?? "—"}
          <span className="text-xs text-zinc-600">/5</span>
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={display}
        // Fire on every value change (covers drags). React maps onChange to the
        // input event for range inputs, but onInput is explicit and reliable.
        // Only a real move commits a value — we never auto-save the placeholder 3.
        onInput={(e) => onChange(Number(e.currentTarget.value))}
        aria-label={label}
        className={cn(!rated && "opacity-70")}
        style={{
          background: `linear-gradient(to right, ${track} ${fill}%, #27272a ${fill}%)`,
        }}
      />
      <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
        <span>Low</span>
        {yesterday != null ? (
          <span>Yesterday: {yesterday}</span>
        ) : (
          <span />
        )}
        <span>High</span>
      </div>
    </div>
  );
}
