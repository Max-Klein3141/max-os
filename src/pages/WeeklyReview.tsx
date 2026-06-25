import { format, parseISO } from "date-fns";
import {
  Activity,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Flame,
  Moon,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { cn } from "../lib/cn";
import { addDays, dateKey, isoWeekDays, isoWeekKey, subDays } from "../lib/dates";
import { isCompleted, isDue } from "../lib/habits";
import { updateSlice, useSlice } from "../lib/store";
import * as db from "../lib/db";
import { weeklyReviewStatus } from "../lib/weekly";
import type { DailyLog, Habit, HabitLogs, WeeklyReview } from "../types";

const TEXT_FIELDS: { key: TextKey; label: string; placeholder: string }[] = [
  { key: "wins", label: "Wins this week", placeholder: "What went well?" },
  {
    key: "mistakes",
    label: "Mistakes & what I'd do differently",
    placeholder: "Where did you slip, and why?",
  },
  { key: "lessons", label: "Lessons learned", placeholder: "What did this week teach you?" },
  {
    key: "goalsProgress",
    label: "Goals progress update",
    placeholder: "How did you move on your goals?",
  },
  {
    key: "focusNext",
    label: "Focus for next week",
    placeholder: "The one or two things that matter most next week.",
  },
];

type TextKey = "wins" | "mistakes" | "lessons" | "goalsProgress" | "focusNext";

function saveReview(week: string, patch: Partial<WeeklyReview>) {
  updateSlice("weeklyReviews", (reviews) => {
    const now = new Date().toISOString();
    const base: WeeklyReview =
      reviews[week] ??
      {
        week,
        wins: "",
        mistakes: "",
        lessons: "",
        goalsProgress: "",
        focusNext: "",
        word: "",
        createdAt: now,
        updatedAt: now,
      };
    const merged: WeeklyReview = { ...base, ...patch, week, updatedAt: now };
    const empty =
      !merged.wins &&
      !merged.mistakes &&
      !merged.lessons &&
      !merged.goalsProgress &&
      !merged.focusNext &&
      !merged.word;
    if (empty) {
      if (!reviews[week]) return reviews;
      const next = { ...reviews };
      delete next[week];
      return next;
    }
    
    // Sync to Supabase in the background
    db.saveWeeklyReview(week, merged).catch(err => console.error("Failed to sync weekly review to Supabase:", err));
    
    return { ...reviews, [week]: merged };
  });
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

interface WeekStats {
  habitRate: number;
  habitDone: number;
  habitDue: number;
  energy: number | null;
  sleep: number | null;
  stress: number | null;
}

function weekStats(
  habits: Habit[],
  logs: HabitLogs,
  dailyLogs: Record<string, DailyLog>,
  days: Date[],
): WeekStats {
  const today = new Date();
  let done = 0;
  let due = 0;
  for (const habit of habits) {
    const createdKey = habit.createdAt.slice(0, 10);
    for (const day of days) {
      if (day > today) continue;
      // Don't count days before the habit existed as missed.
      if (dateKey(day) < createdKey) continue;
      if (isDue(habit, day)) {
        due++;
        if (isCompleted(logs, habit.id, dateKey(day))) done++;
      }
    }
  }
  const energies: number[] = [];
  const sleeps: number[] = [];
  const stresses: number[] = [];
  for (const day of days) {
    const l = dailyLogs[dateKey(day)];
    if (l?.energy) energies.push(l.energy);
    if (l?.sleep) sleeps.push(l.sleep);
    if (l?.stress) stresses.push(l.stress);
  }
  return {
    habitRate: due === 0 ? 0 : Math.round((done / due) * 100),
    habitDone: done,
    habitDue: due,
    energy: avg(energies),
    sleep: avg(sleeps),
    stress: avg(stresses),
  };
}

export default function WeeklyReviewPage() {
  const habits = useSlice("habits");
  const logs = useSlice("habitLogs");
  const dailyLogs = useSlice("dailyLogs");
  const reviews = useSlice("weeklyReviews");
  const [refDate, setRefDate] = useState(new Date());

  const weekKey = isoWeekKey(refDate);
  const days = isoWeekDays(refDate);
  const active = habits.filter((h) => !h.archived);
  const stats = weekStats(active, logs, dailyLogs, days);
  const status = weeklyReviewStatus(reviews);

  const pastWeeks = Object.values(reviews)
    .sort((a, b) => b.week.localeCompare(a.week))
    .slice(0, 12);

  const rangeLabel = `${format(days[0], "MMM d")} – ${format(days[6], "MMM d, yyyy")}`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Weekly Review
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRefDate((d) => subDays(d, 7))}
            className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[5rem] text-center text-sm font-medium text-zinc-300">
            {weekKey}
          </span>
          <button
            type="button"
            onClick={() => setRefDate((d) => addDays(d, 7))}
            className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {status.state !== "ok" && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-3">
          <CalendarCheck size={16} className="shrink-0 text-amber-400" />
          <p className="flex-1 text-sm text-amber-100/90">
            {status.state === "dueToday"
              ? `It's Sunday — this week (${status.week}) isn't done yet. Take a few minutes below.`
              : `Your weekly review for ${status.week} was never completed.`}
          </p>
          {status.week !== weekKey && (
            <button
              type="button"
              onClick={() => setRefDate(parseISO(status.week))}
              className="shrink-0 rounded-lg border border-amber-400/40 px-3 py-1 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-400/10"
            >
              Open {status.week}
            </button>
          )}
        </div>
      )}

      {pastWeeks.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {pastWeeks.map((r) => (
            <button
              key={r.week}
              type="button"
              onClick={() => setRefDate(parseISO(r.week))}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                r.week === weekKey
                  ? "border-indigo-400/50 bg-indigo-400/15 text-indigo-200"
                  : "border-zinc-800 text-zinc-400 hover:text-white",
              )}
            >
              {r.week}
              {r.word && <span className="ml-1.5 text-zinc-500">· {r.word}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Auto-populated stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Flame}
          label="Habits held up"
          value={`${stats.habitRate}%`}
          hint={`${stats.habitDone}/${stats.habitDue} days`}
          color="#fbbf24"
        />
        <StatCard
          icon={Zap}
          label="Avg energy"
          value={stats.energy != null ? `${stats.energy}` : "—"}
          hint="of 5"
          color="#34d399"
        />
        <StatCard
          icon={Moon}
          label="Avg sleep"
          value={stats.sleep != null ? `${stats.sleep}` : "—"}
          hint="of 5"
          color="#818cf8"
        />
        <StatCard
          icon={Activity}
          label="Avg stress"
          value={stats.stress != null ? `${stats.stress}` : "—"}
          hint="of 5"
          color="#fb923c"
        />
      </div>

      <Editor key={weekKey} weekKey={weekKey} review={reviews[weekKey]} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  color,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  hint: string;
  color: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Icon size={13} style={{ color }} /> {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums text-white">{value}</span>
        <span className="text-xs text-zinc-600">{hint}</span>
      </div>
    </Card>
  );
}

function Editor({
  weekKey,
  review,
}: {
  weekKey: string;
  review?: WeeklyReview;
}) {
  const [fields, setFields] = useState({
    wins: review?.wins ?? "",
    mistakes: review?.mistakes ?? "",
    lessons: review?.lessons ?? "",
    goalsProgress: review?.goalsProgress ?? "",
    focusNext: review?.focusNext ?? "",
    word: review?.word ?? "",
  });

  useEffect(() => {
    const t = setTimeout(() => saveReview(weekKey, fields), 500);
    return () => clearTimeout(t);
  }, [fields, weekKey]);

  function set<K extends keyof typeof fields>(key: K, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          One word for this week
        </label>
        <input
          value={fields.word}
          onChange={(e) => set("word", e.target.value)}
          placeholder="Focused"
          className="w-full bg-transparent text-3xl font-bold tracking-tight text-white placeholder:text-zinc-700 focus:outline-none"
        />
      </Card>

      {TEXT_FIELDS.map((f) => (
        <div key={f.key}>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">
            {f.label}
          </label>
          <textarea
            value={fields[f.key]}
            onChange={(e) => set(f.key, e.target.value)}
            rows={3}
            placeholder={f.placeholder}
            className="min-h-[5rem] w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
          />
        </div>
      ))}

      <p className="text-xs text-zinc-600">Changes save automatically.</p>
    </div>
  );
}
