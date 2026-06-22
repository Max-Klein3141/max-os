import {
  Archive,
  ArchiveRestore,
  Check,
  Flame,
  Pencil,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { PageHeader } from "../components/PageHeader";
import { ReminderBanner } from "../components/ReminderBanner";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { cn } from "../lib/cn";
import { dateKey, humanDate, recentDays } from "../lib/dates";
import {
  HABIT_CATEGORIES,
  HABIT_COLORS,
  MOMENTUM_WINDOW_DAYS,
  addHabit,
  currentStreak,
  deleteHabit,
  frequencyLabel,
  isCompleted,
  isDue,
  longestStreak,
  setHabitArchived,
  toggleHabitLog,
  updateHabit,
  weightedConsistency,
} from "../lib/habits";
import type { HabitInput } from "../lib/habits";
import { useSlice } from "../lib/store";
import type { Habit, HabitCategory, HabitFrequency, HabitLogs } from "../types";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export default function Habits() {
  const habits = useSlice("habits");
  const logs = useSlice("habitLogs");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);

  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);
  const consistency = weightedConsistency(active, logs);

  const today = dateKey(new Date());
  const now = new Date();
  const remainingToday = active.filter(
    (h) => isDue(h, now) && !isCompleted(logs, h.id, today),
  ).length;

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

      {remainingToday > 0 && (
        <div className="mb-5">
          <ReminderBanner icon={Flame}>
            You have {remainingToday} habit{remainingToday > 1 ? "s" : ""} left to
            check off today.
          </ReminderBanner>
        </div>
      )}

      <MomentumScale
        score={consistency.weighted}
        rate={consistency.rate}
        done={consistency.done}
        due={consistency.due}
      />

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
        <div className="mt-6">
          <HabitGrid habits={active} logs={logs} onEdit={setEditing} />
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

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? "Edit habit" : "New habit"}
      >
        <HabitForm
          key={editing?.id ?? "new"}
          initial={editing ?? undefined}
          submitLabel={editing ? "Save changes" : "Create habit"}
          onSubmit={(input) => {
            if (editing) {
              // Preserve id, createdAt, archived and all log/streak data —
              // only the metadata fields from the form change.
              updateHabit({ ...editing, ...input });
            } else {
              addHabit(input);
            }
            setCreating(false);
            setEditing(null);
          }}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
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
  score,
  rate,
  done,
  due,
}: {
  score: number;
  rate: number;
  done: number;
  due: number;
}) {
  const color = score >= 70 ? "#34d399" : score >= 40 ? "#fbbf24" : "#f87171";
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-end justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Momentum scale
          <span className="ml-2 font-normal normal-case text-zinc-600">
            recent days weighted more
          </span>
        </h2>
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          {score}%
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        Share of scheduled habit-days you've checked off over the last{" "}
        {MOMENTUM_WINDOW_DAYS} days, with more recent days counting more. {done} of{" "}
        {due} boxes checked ({rate}% flat).
      </p>
    </Card>
  );
}

/** All habits in one grid: weekday columns across the last 14 days, one row per habit. */
function HabitGrid({
  habits,
  logs,
  onEdit,
}: {
  habits: Habit[];
  logs: HabitLogs;
  onEdit: (habit: Habit) => void;
}) {
  const goals = useSlice("goals");
  const days = recentDays(14);
  const today = dateKey(new Date());

  return (
    <Card className="p-5">
      <div className="overflow-x-auto">
        <div className="min-w-max space-y-1.5">
          {/* Weekday header, oldest → today */}
          <div className="flex items-end gap-1.5">
            <div className="w-52 shrink-0 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
              Last 14 days
            </div>
            {days.map((day) => {
              const isToday = dateKey(day) === today;
              return (
                <div key={dateKey(day)} className="flex w-8 shrink-0 flex-col items-center">
                  <span
                    className={cn(
                      "text-[10px] font-semibold",
                      isToday ? "text-white" : "text-zinc-500",
                    )}
                  >
                    {WEEKDAY_LETTERS[day.getDay()]}
                  </span>
                  <span className="text-[9px] text-zinc-600">{day.getDate()}</span>
                </div>
              );
            })}
          </div>

          {/* One row per habit */}
          {habits.map((habit) => {
            const streak = currentStreak(habit, logs);
            const category = HABIT_CATEGORIES.find((c) => c.value === habit.category);
            const linkedGoal = habit.goalId
              ? goals.find((g) => g.id === habit.goalId)
              : undefined;
            const createdKey = habit.createdAt.slice(0, 10);
            return (
              <div key={habit.id} className="group flex items-center gap-1.5">
                <div className="flex w-52 shrink-0 items-center gap-2 pr-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: habit.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <span
                      className="block truncate text-sm text-zinc-200"
                      title={`${category?.label} · ${frequencyLabel(habit)} · longest streak ${longestStreak(habit, logs)}`}
                    >
                      {habit.name}
                    </span>
                    {habit.identityStatement && (
                      <span className="block truncate text-[11px] italic text-zinc-500">
                        {habit.identityStatement}
                      </span>
                    )}
                    {linkedGoal && (
                      <span className="flex items-center gap-1 truncate text-[11px] text-indigo-300/80">
                        <Target size={9} className="shrink-0" />
                        {linkedGoal.title || "Untitled goal"}
                      </span>
                    )}
                  </div>
                  {streak > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 group-hover:hidden">
                      <Flame size={11} /> {streak}
                    </span>
                  )}
                  <span className="hidden items-center gap-0.5 group-hover:flex">
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => onEdit(habit)}
                      className="rounded p-1 text-zinc-500 hover:text-zinc-200"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      title="Archive"
                      onClick={() => setHabitArchived(habit.id, true)}
                      className="rounded p-1 text-zinc-500 hover:text-zinc-200"
                    >
                      <Archive size={13} />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => confirmDelete(habit)}
                      className="rounded p-1 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </div>
                {days.map((day) => {
                  const key = dateKey(day);
                  // Before the habit existed: a neutral, empty cell — never a miss.
                  if (key < createdKey) {
                    return (
                      <div
                        key={key}
                        title={`${humanDate(key)} · before this habit existed`}
                        className="h-8 w-8 shrink-0 rounded-md border border-transparent bg-zinc-900/20"
                      />
                    );
                  }
                  const done = isCompleted(logs, habit.id, key);
                  const due = isDue(habit, day);
                  const isToday = key === today;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleHabitLog(habit.id, key)}
                      title={`${habit.name} · ${humanDate(key)}${done ? " · done" : due ? " · missed" : " · not scheduled"}`}
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-transform hover:scale-110",
                        done
                          ? "border-transparent"
                          : due
                            ? "border-zinc-700"
                            : "border-transparent bg-zinc-900/40",
                        isToday && "ring-1 ring-inset ring-white/25",
                      )}
                      style={done ? { backgroundColor: habit.color } : undefined}
                    >
                      {done && <Check size={13} className="text-zinc-950" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

const FREQUENCIES: { value: HabitFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "custom", label: "Custom" },
];

function HabitForm({
  initial,
  submitLabel = "Create habit",
  onSubmit,
  onCancel,
}: {
  initial?: Habit;
  submitLabel?: string;
  onSubmit: (input: HabitInput) => void;
  onCancel: () => void;
}) {
  const goals = useSlice("goals");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<HabitCategory>(
    initial?.category ?? "health",
  );
  const [frequency, setFrequency] = useState<HabitFrequency>(
    initial?.frequency ?? "daily",
  );
  const [customDays, setCustomDays] = useState<number[]>(
    initial?.customDays ?? [1, 2, 3, 4, 5],
  );
  const [color, setColor] = useState(initial?.color ?? HABIT_COLORS[0]);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [identityStatement, setIdentityStatement] = useState(
    initial?.identityStatement ?? "",
  );
  const [goalId, setGoalId] = useState(initial?.goalId ?? "");
  const [minimumViable, setMinimumViable] = useState(initial?.minimumViable ?? "");

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
      identityStatement: identityStatement.trim() || undefined,
      goalId: goalId || undefined,
      minimumViable: minimumViable.trim() || undefined,
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

      <Field label="Identity statement (optional)">
        <input
          value={identityStatement}
          onChange={(e) => setIdentityStatement(e.target.value)}
          placeholder="I am someone who…"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
        />
      </Field>

      <Field label="This habit serves (optional)">
        <select
          value={goalId}
          onChange={(e) => setGoalId(e.target.value)}
          disabled={goals.length === 0}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-400/50 focus:outline-none disabled:cursor-not-allowed disabled:text-zinc-600"
        >
          {goals.length === 0 ? (
            <option value="">Add goals in Planner &amp; Goals first</option>
          ) : (
            <>
              <option value="">No linked goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title || "Untitled goal"}
                </option>
              ))}
            </>
          )}
        </select>
      </Field>

      <Field label="On a hard day, I'll at least… (optional)">
        <input
          value={minimumViable}
          onChange={(e) => setMinimumViable(e.target.value)}
          placeholder="e.g. do 5 push-ups, drink 3 glasses"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
        />
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
          {submitLabel}
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
