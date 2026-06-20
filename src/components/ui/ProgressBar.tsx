import { clamp, cn } from "../../lib/cn";

interface ProgressBarProps {
  value: number; // 0–100
  className?: string;
  color?: string; // overrides the default indigo fill
}

export function ProgressBar({ value, className, color }: ProgressBarProps) {
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-zinc-800", className)}
    >
      <div
        className="h-full rounded-full bg-indigo-400 transition-all duration-300"
        style={{
          width: `${clamp(value, 0, 100)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}
