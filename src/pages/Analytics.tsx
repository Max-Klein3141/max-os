import { format, parseISO } from "date-fns";
import { Flame, Trophy } from "lucide-react";
import { cloneElement, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/ui/Card";
import { recentWins } from "../lib/daily";
import { dateKey, isoWeekKey, recentDays, subDays } from "../lib/dates";
import { completionStats, currentStreak } from "../lib/habits";
import { computeMomentum } from "../lib/momentum";
import { useDatabase } from "../lib/store";

const AXIS = { fill: "#71717a", fontSize: 11 };
const TOOLTIP_STYLE = {
  background: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 8,
  fontSize: 12,
  color: "#fafafa",
};

export default function Analytics() {
  const db = useDatabase();
  const active = db.habits.filter((h) => !h.archived);

  const momentumData = useMemo(
    () =>
      recentDays(90).map((d) => ({
        label: format(d, "M/d"),
        score: computeMomentum(db, d).score,
      })),
    [db],
  );

  const habitRates = useMemo(
    () =>
      active
        .map((h) => ({
          name: h.name,
          rate: completionStats(h, db.habitLogs, 30).rate,
          color: h.color,
        }))
        .sort((a, b) => b.rate - a.rate),
    [active, db.habitLogs],
  );

  const vitals = useMemo(
    () =>
      recentDays(30).map((d) => {
        const l = db.dailyLogs[dateKey(d)];
        return {
          label: format(d, "M/d"),
          energy: l?.energy ?? null,
          sleep: l?.sleep ?? null,
          stress: l?.stress ?? null,
        };
      }),
    [db.dailyLogs],
  );

  const weeks = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = subDays(today, i * 7);
      out.push({ key: isoWeekKey(d), label: format(d, "MMM d") });
    }
    return out;
  }, []);

  const journalPerWeek = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of Object.values(db.journal)) {
      const k = isoWeekKey(parseISO(e.date));
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return weeks.map((w) => ({ label: w.label, count: counts[w.key] ?? 0 }));
  }, [db.journal, weeks]);

  const kbGrowth = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 12 }, (_, idx) => {
      const i = 11 - idx;
      const d = subDays(today, i * 7);
      const total = db.knowledge.filter(
        (e) => parseISO(e.createdAt) <= d,
      ).length;
      return { label: format(d, "MMM d"), total };
    });
  }, [db.knowledge]);

  const leaderboard = useMemo(
    () =>
      active
        .map((h) => ({ habit: h, streak: currentStreak(h, db.habitLogs) }))
        .sort((a, b) => b.streak - a.streak),
    [active, db.habitLogs],
  );

  const wins = recentWins(db.dailyLogs, 30);
  const maxStreak = Math.max(1, ...leaderboard.map((l) => l.streak));

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Your trends at a glance." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard
          title="Momentum"
          subtitle="Last 90 days"
          className="lg:col-span-2"
        >
          <Chart height={224}>
            <LineChart data={momentumData} margin={{ left: -20, right: 8, top: 5 }}>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                interval={14}
              />
              <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "#3f3f46" }} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#818cf8"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </Chart>
        </ChartCard>

        <ChartCard title="Habit completion" subtitle="Last 30 days">
          {habitRates.length === 0 ? (
            <Empty>No habits to chart yet.</Empty>
          ) : (
            <Chart height={Math.max(140, habitRates.length * 38)}>
              <BarChart
                data={habitRates}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid stroke="#27272a" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={AXIS}
                  width={100}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: "#27272a55" }}
                  formatter={(v) => [`${v}%`, "Completion"]}
                />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={16}>
                  {habitRates.map((h) => (
                    <Cell key={h.name} fill={h.color} />
                  ))}
                </Bar>
              </BarChart>
            </Chart>
          )}
        </ChartCard>

        <ChartCard title="Streak leaderboard" subtitle="Current streaks">
          {leaderboard.length === 0 ? (
            <Empty>No habits yet.</Empty>
          ) : (
            <ul className="space-y-2.5">
              {leaderboard.map(({ habit, streak }, i) => (
                <li key={habit.id} className="flex items-center gap-3">
                  <span className="w-4 text-xs font-medium text-zinc-600">
                    {i + 1}
                  </span>
                  <span className="w-28 shrink-0 truncate text-sm text-zinc-300">
                    {habit.name}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(streak / maxStreak) * 100}%`,
                        backgroundColor: habit.color,
                      }}
                    />
                  </div>
                  <span className="inline-flex w-10 items-center justify-end gap-1 text-xs font-medium text-amber-400">
                    <Flame size={12} /> {streak}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        <ChartCard title="Energy · Sleep · Stress" subtitle="Last 30 days">
          <Chart height={208}>
            <LineChart data={vitals} margin={{ left: -24, right: 8, top: 5 }}>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} interval={5} axisLine={false} tickLine={false} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "#3f3f46" }} />
              <Line type="monotone" dataKey="energy" stroke="#34d399" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="sleep" stroke="#818cf8" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="stress" stroke="#fb923c" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </Chart>
          <Legend
            items={[
              { label: "Energy", color: "#34d399" },
              { label: "Sleep", color: "#818cf8" },
              { label: "Stress", color: "#fb923c" },
            ]}
          />
        </ChartCard>

        <ChartCard title="Journal entries" subtitle="Per week, last 12 weeks">
          <Chart height={208}>
            <BarChart data={journalPerWeek} margin={{ left: -24, right: 8, top: 5 }}>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} interval={1} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#27272a55" }} />
              <Bar dataKey="count" fill="#a78bfa" radius={[4, 4, 0, 0]} barSize={18} />
            </BarChart>
          </Chart>
        </ChartCard>

        <ChartCard title="Knowledge base" subtitle="Total entries over time">
          <Chart height={208}>
            <LineChart data={kbGrowth} margin={{ left: -24, right: 8, top: 5 }}>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} interval={1} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "#3f3f46" }} />
              <Line type="monotone" dataKey="total" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </Chart>
        </ChartCard>

        <ChartCard title="Win log" subtitle="Last 30 wins" className="lg:col-span-2">
          {wins.length === 0 ? (
            <Empty>Log a win on the Today page to start your feed.</Empty>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {wins.map((w) => (
                <li
                  key={w.date}
                  className="flex items-start gap-3 rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2"
                >
                  <Trophy size={14} className="mt-0.5 shrink-0 text-amber-400" />
                  <div>
                    <div className="text-sm text-zinc-200">{w.win}</div>
                    <div className="text-[11px] text-zinc-600">
                      {format(parseISO(w.date), "MMM d, yyyy")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

/**
 * Sizes a Recharts chart without ResponsiveContainer. We measure the box's
 * width with a ResizeObserver and pass concrete pixel width/height straight to
 * the chart, rendering it only once we have a real width. This avoids the
 * "width(-1)/height(-1) should be greater than 0" warning ResponsiveContainer
 * logs on its initial (pre-layout) measurement.
 */
function Chart({
  height,
  children,
}: {
  height: number;
  children: ReactElement<{ width?: number; height?: number }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: "100%", height }}>
      {width > 0 && cloneElement(children, { width, height })}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className ? `p-5 ${className}` : "p-5"}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-600">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-40 items-center justify-center text-center text-sm text-zinc-600">
      {children}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-4">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
