import type { ComponentType } from "react";

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
  const display = value ?? 3;
  const fill = ((display - 1) / 4) * 100;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-300">
          <Icon size={15} className="text-zinc-500" />
          {label}
        </span>
        <span
          className="text-lg font-semibold tabular-nums"
          style={{ color: value ? accent : "#52525b" }}
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
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        style={{
          background: `linear-gradient(to right, ${accent} ${fill}%, #27272a ${fill}%)`,
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
