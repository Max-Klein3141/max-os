import { clamp } from "../../lib/cn";

interface GaugeProps {
  value: number; // 0–100
  size?: number;
  stroke?: number;
  label?: string;
}

/** Color-shifting arc gauge with the value rendered in the center. */
export function Gauge({ value, size = 200, stroke = 16, label = "Momentum" }: GaugeProps) {
  const v = Math.round(clamp(value, 0, 100));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (v / 100) * circ;
  const color = v >= 75 ? "#34d399" : v >= 45 ? "#fbbf24" : "#f87171";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#27272a"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold tracking-tight tabular-nums text-white">
          {v}
        </span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-widest text-zinc-500">
          {label}
        </span>
      </div>
    </div>
  );
}
