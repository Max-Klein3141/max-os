import {
  Archive,
  ArchiveRestore,
  Check,
  Flame,
  Plus,
  Trash2,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { cn } from "../lib/cn";
import { dateKey, humanDate, recentDays } from "../lib/dates";
import {
  HABIT_CATEGORIES,
  HABIT_COLORS,
  addHabit,
  aggregateConsistency,
  completionStats,
  currentStreak,
  deleteHabit,
  frequencyLabel,
  isCompleted,
  isDue,
  longestStreak,
  setHabitArchived,
  toggleHabitLog,
} from "../lib/habits";
import type { HabitInput } from "../lib/habits";
import { useSlice } from "../lib/store";
import type { Habit, HabitCategory, HabitFrequency, HabitLogs } from "../types";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export default function Habits() {
  const habits = useSlice("habits");
  const logs = useSlice("habitLogs");
  const [creating, setCreating] = useState(false);

  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);
  const consistency = aggregateConsistency(active, logs, 30);

  return (
    <div>
      <PageHeader
        title="Habits"
        subtitle="Build consistency, one day at a time."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={15} /> New habit
          </Button>
        }
      />

      <MomentumScale rate={consistency.rate} done={consistency.done} due={consistency.due} />

      {active.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon={Flame}
            title="No habits yet"
            subtitle="Create your first habit to start tracking streaks."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus size={15} /> New habit
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {active.map((habit) => (
            <HabitCard key={habit.id} habit={habit} logs={logs} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-600">
            Archived
          </h2>
          <div className="space-y-3">
            {archived.map((habit) => (
              <Card
                key={habit.id}
                className="flex items-center justify-between p-4"
              >
                <span className="flex items-center gap-2 text-sm text-zinc-400">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: habit.color }}
                  />
                  {habit.name}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setHabitArchived(habit.id, false)}
                  >
                    <ArchiveRestore size={14} /> Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => confirmDelete(habit)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New habit">
        <HabitForm
          onSubmit={(input) => {
            addHabit(input);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      </Modal>
    </div>
  );
}

function confirmDelete(habit: Habit) {
  if (
    window.confirm(
      `Delete "${habit.name}"? This also removes its completion history.`,
    )
  ) {
    deleteHabit(habit.id);
  }
}

function MomentumScale({
  rate,
  done,
  due,
}: {
  rate: number;
  done: number;
  due: number;
}) {
  const color = rate >= 70 ? "#34d399" : rate >= 40 ? "#fbbf24" : "#f87171";
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-end justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Momentum scale
          <span className="ml-2 font-normal normal-case text-zinc-600">
            last 30 days
          </span>
        </h2>
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          {rate}%
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${rate}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        {done} of {due} scheduled habit-days completed.
      </p>
    </Card>
  );
}

function HabitCard({ habit, logs }: { habit: Habit; logs: HabitLogs }) {
  const streak = currentStreak(habit, logs);
  const longest = longestStreak(habit, logs);
  const stats = completionStats(habit, logs, 30);
  const category = HABIT_CATEGORIES.find((c) => c.value === habit.category);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: habit.color }}
            />
            <h3 className="truncate font-semibold text-white">{habit.name}</h3>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {category?.label} · {frequencyLabel(habit)} · {stats.rate}% this
            month
          </p>
          {habit.description && (
            <p className="mt-1 text-sm text-zinc-500">{habit.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-amber-400">
              <Flame size={13} /> {streak}
            </span>
            <span className="inline-flex items-center gap-1 text-zinc-500">
              <Trophy size={13} /> {longest}
            </span>
          </div>
          <div className="flex gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              title="Archive"
              onClick={() => setHabitArchived(habit.id, true)}
            >
              <Archive size={14} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              title="Delete"
              onClick={() => confirmDelete(habit)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      </div>

      <HabitHeatmap habit={habit} logs={logs} />
    </Card>
  );
}

function HabitHeatmap({ habit, logs }: { habit: Habit; logs: HabitLogs }) {
  const days = recentDays(60);
  // Pad the front so the first cell lands on its correct weekday row.
  const offset = days[0].getDay();
  const cells: (Date | null)[] = [...Array(offset).fill(null), ...days];

  return (
    <div className="mt-4 overflow-x-auto">
      <div className="flex gap-2">
        <div
          className="grid shrink-0 gap-[3px] text-[9px] text-zinc-600"
          style={{ gridTemplateRows: "repeat(7, 13px)" }}
        >
          {WEEKDAY_LETTERS.map((d, i) => (
            <span key={i} className="flex h-[13px] items-center">
              {i % 2 === 1 ? d : ""}
            </span>
          ))}
        </div>
        <div
          className="grid gap-[3px]"
          style={{
            gridTemplateRows: "repeat(7, 13px)",
            gridAutoFlow: "column",
          }}
        >
          {cells.map((day, i) => {
            if (!day) return <span key={`pad-${i}`} className="h-[13px] w-[13px]" />;
            const key = dateKey(day);
            const done = isCompleted(logs, habit.id, key);
            const due = isDue(habit, day);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleHabitLog(habit.id, key)}
                title={`${humanDate(key)}${done ? " · done" : due ? " · missed" : " · not scheduled"}`}
                className={cn(
                  "h-[13px] w-[13px] rounded-[3px] transition-transform hover:scale-125",
                  !done && (due ? "bg-zinc-800" : "bg-zinc-800/40"),
                )}
                style={done ? { backgroundColor: habit.color } : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

const FREQUENCIES: { value: HabitFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "custom", label: "Custom" },
];

function HabitForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: HabitInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<HabitCategory>("health");
  const [frequency, setFrequency] = useState<HabitFrequency>("daily");
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [color, setColor] = useState(HABIT_COLORS[0]);
  const [description, setDescription] = useState("");

  const canSave = name.trim().length > 0;

  function toggleDay(day: number) {
    setCustomDays((d) =>
      d.includes(day) ? d.filter((x) => x !== day) : [...d, day],
    );
  }

  function submit() {
    if (!canSave) return;
    onSubmit({
      name: name.trim(),
      category,
      frequency,
      customDays: frequency === "custom" ? customDays : undefined,
      color,
      description: description.trim() || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <Field label="Name">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="e.g. Morning workout"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
        />
      </Field>

      <Field label="Category">
        <div className="flex flex-wrap gap-2">
          {HABIT_CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === c.value
                  ? "border-indigo-400/50 bg-indigo-400/15 text-indigo-200"
                  : "border-zinc-700 text-zinc-400 hover:text-white",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Frequency">
        <div className="flex gap-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFrequency(f.value)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                frequency === f.value
                  ? "border-indigo-400/50 bg-indigo-400/15 text-indigo-200"
                  : "border-zinc-700 text-zinc-400 hover:text-white",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {frequency === "custom" && (
          <div className="mt-2 flex gap-1.5">
            {WEEKDAY_LETTERS.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold transition-colors",
                  customDays.includes(i)
                    ? "border-indigo-400/50 bg-indigo-400/15 text-indigo-200"
                    : "border-zinc-700 text-zinc-500 hover:text-white",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field label="Color">
        <div className="flex flex-wrap gap-2">
          {HABIT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110",
                color === c && "ring-2 ring-white ring-offset-2 ring-offset-zinc-900",
              )}
              style={{ backgroundColor: c }}
            >
              {color === c && <Check size={13} className="text-zinc-950" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Description (optional)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Why does this habit matter?"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
        />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!canSave} onClick={submit}>
          Create habit
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      {children}
    </div>
  );
}
