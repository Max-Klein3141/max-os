import { format } from "date-fns";
import {
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  GripVertical,
  ImagePlus,
  Pencil,
  Plus,
  Star,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { ProgressBar } from "../components/ui/ProgressBar";
import {
  buildICS,
  clampMinutes,
  downloadICS,
  durationLabel,
  fromTimeInput,
  googleCalendarUrl,
  isScheduled,
  timeLabel,
  toTimeInput,
} from "../lib/calendar";
import { clamp, cn } from "../lib/cn";
import { addDays, dateKey, humanDate, parseKey, subDays, todayKey } from "../lib/dates";
import { fileToCompressedDataURL } from "../lib/image";
import { getDatabase, setSlice, uid, updateSlice, useSlice } from "../lib/store";
import * as db from "../lib/db";
import type { Goal, GoalHorizon, Milestone, Todo } from "../types";

const HORIZONS: { value: GoalHorizon; label: string; hint: string }[] = [
  { value: "short", label: "Short-term", hint: "< 3 months" },
  { value: "mid", label: "Mid-term", hint: "3–12 months" },
  { value: "long", label: "Long-term", hint: "1–5 years" },
];

// ── Todo helpers ─────────────────────────────────────────────────────────────

function rolloverTodos(): number {
  const today = todayKey();
  const todos = getDatabase().todos;
  let rolled = 0;
  const next = todos.map((t) => {
    if (!t.done && t.date < today) {
      rolled++;
      return { ...t, date: today };
    }
    return t;
  });
  if (rolled) setSlice("todos", next);
  return rolled;
}

function nextOrder(date: string): number {
  return getDatabase()
    .todos.filter((t) => t.date === date)
    .reduce((m, t) => Math.max(m, t.order), -1) + 1;
}

function addTodo(text: string, date: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  updateSlice("todos", (todos) => [
    ...todos,
    {
      id: uid(),
      text: trimmed,
      done: false,
      priority: false,
      date,
      order: nextOrder(date),
      createdAt: new Date().toISOString(),
    },
  ]);
}

/** Create a task that's scheduled into the day timeline straight away. */
function createScheduledTodo(
  text: string,
  date: string,
  startMin: number,
  durationMin: number,
  goalId?: string,
) {
  const trimmed = text.trim();
  if (!trimmed) return;
  updateSlice("todos", (todos) => [
    ...todos,
    {
      id: uid(),
      text: trimmed,
      done: false,
      priority: false,
      date,
      order: nextOrder(date),
      startMin: clampMinutes(startMin),
      durationMin,
      goalId,
      createdAt: new Date().toISOString(),
    },
  ]);
}

const MAX_PRIORITY = 3;

/**
 * Toggle a task's "priority" star, capped at MAX_PRIORITY per day so the
 * focus list stays short. Turning a star off always works.
 */
function togglePriority(todo: Todo) {
  if (!todo.priority) {
    const count = getDatabase().todos.filter(
      (t) => t.date === todo.date && t.priority,
    ).length;
    if (count >= MAX_PRIORITY) return;
  }
  patchTodo(todo.id, { priority: !todo.priority });
}

function patchTodo(id: string, patch: Partial<Todo>) {
  updateSlice("todos", (todos) =>
    todos.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  );
}

function removeTodo(id: string) {
  updateSlice("todos", (todos) => todos.filter((t) => t.id !== id));
}

/** Drop a task's time-box, returning it to the loose to-do list. */
function unscheduleTodo(id: string) {
  patchTodo(id, { startMin: undefined, durationMin: undefined });
}

/** Reorder within the unscheduled to-do list for a given day. */
function reorderTodos(sourceId: string, targetId: string, date: string) {
  const all = getDatabase().todos;
  const list = all
    .filter((t) => t.date === date && !isScheduled(t))
    .sort((a, b) => a.order - b.order);
  const from = list.findIndex((t) => t.id === sourceId);
  const to = list.findIndex((t) => t.id === targetId);
  if (from < 0 || to < 0 || from === to) return;
  const reordered = [...list];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  const orderMap = new Map(reordered.map((t, i) => [t.id, i] as const));
  setSlice(
    "todos",
    all.map((t) =>
      orderMap.has(t.id) ? { ...t, order: orderMap.get(t.id) as number } : t,
    ),
  );
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180];

function blankScheduledTodo(date: string): Todo {
  return {
    id: uid(),
    text: "",
    done: false,
    priority: false,
    date,
    order: 0,
    startMin: 9 * 60,
    durationMin: 60,
    createdAt: new Date().toISOString(),
  };
}

// ── Goal helpers ─────────────────────────────────────────────────────────────

function saveGoal(goal: Goal) {
  updateSlice("goals", (goals) => {
    const exists = goals.some((g) => g.id === goal.id);
    return exists ? goals.map((g) => (g.id === goal.id ? goal : g)) : [...goals, goal];
  });
  
  // Sync to Supabase in the background
  if (goal.id.startsWith('local-')) {
    // New goal
    db.createGoal(goal).catch(err => console.error("Failed to create goal in Supabase:", err));
  } else {
    // Existing goal
    db.updateGoal(goal.id, goal).catch(err => console.error("Failed to update goal in Supabase:", err));
  }
}

function deleteGoal(id: string) {
  updateSlice("goals", (goals) => goals.filter((g) => g.id !== id));
  
  // Sync deletion to Supabase in the background
  db.deleteGoal(id).catch(err => console.error("Failed to delete goal in Supabase:", err));
}

function blankGoal(horizon: GoalHorizon): Goal {
  return {
    id: uid(),
    title: "",
    description: "",
    horizon,
    progress: 0,
    milestones: [],
    createdAt: new Date().toISOString(),
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Planner() {
  const [rolled, setRolled] = useState(0);

  useEffect(() => {
    setRolled(rolloverTodos());
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Planner & Goals"
        subtitle="Run today, aim at the horizon."
      />
      <DailyPlanner rolled={rolled} />
      <Goals />
    </div>
  );
}

function Checkbox({ done, onClick }: { done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
        done
          ? "border-transparent bg-indigo-400"
          : "border-zinc-600 hover:border-zinc-400",
      )}
    >
      {done && <Check size={13} className="text-zinc-950" strokeWidth={3} />}
    </button>
  );
}

function DateNav({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (key: string) => void;
}) {
  const isToday = selected === todayKey();
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(dateKey(subDays(parseKey(selected), 1)))}
        className="rounded-lg border border-zinc-800 p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        aria-label="Previous day"
      >
        <ChevronLeft size={15} />
      </button>
      <button
        type="button"
        onClick={() => onChange(todayKey())}
        title="Jump to today"
        className={cn(
          "min-w-[6.5rem] rounded-lg border px-2 py-1 text-center text-xs font-medium transition-colors",
          isToday
            ? "border-indigo-400/40 text-indigo-200"
            : "border-zinc-800 text-zinc-300 hover:bg-zinc-800",
        )}
      >
        {isToday ? "Today" : format(parseKey(selected), "EEE, MMM d")}
      </button>
      <button
        type="button"
        onClick={() => onChange(dateKey(addDays(parseKey(selected), 1)))}
        className="rounded-lg border border-zinc-800 p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        aria-label="Next day"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

function DailyPlanner({ rolled }: { rolled: number }) {
  const todos = useSlice("todos");
  const [selected, setSelected] = useState(todayKey());
  const [text, setText] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<{
    initial: Todo;
    isNew: boolean;
  } | null>(null);

  const dayTodos = todos.filter((t) => t.date === selected);
  const unscheduled = dayTodos
    .filter((t) => !isScheduled(t))
    .sort((a, b) => a.order - b.order);
  const scheduled = dayTodos
    .filter(isScheduled)
    .sort((a, b) => a.startMin - b.startMin);
  const priority = dayTodos
    .filter((t) => t.priority)
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_PRIORITY);
  const remaining = dayTodos.filter((t) => !t.done).length;
  const isToday = selected === todayKey();

  function submit() {
    addTodo(text, selected);
    setText("");
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            <CalendarClock size={15} className="text-indigo-400" /> Plan your day
          </h2>
          <span className="text-xs text-zinc-600">{remaining} left</span>
          {isToday && rolled > 0 && (
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-300">
              {rolled} rolled over
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DateNav selected={selected} onChange={setSelected} />
          <Button
            size="sm"
            onClick={() =>
              downloadICS(`max-os-${selected}.ics`, buildICS(scheduled))
            }
            disabled={scheduled.length === 0}
            title="Download this day's time blocks as an .ics file to import into Google Calendar"
          >
            <Download size={14} /> Export .ics
          </Button>
        </div>
      </div>

      {dayTodos.length > 0 && (
        <PrioritySection priority={priority} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Unscheduled to-dos */}
        <Card className="p-4">
          <div className="mb-3 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="Add a task and press Enter…"
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
            />
            <Button variant="primary" onClick={submit}>
              <Plus size={15} />
            </Button>
          </div>

          {unscheduled.length === 0 ? (
            <EmptyState
              icon={Check}
              title="Nothing to schedule"
              subtitle="Add tasks, then block time for them."
            />
          ) : (
            <ul className="space-y-1">
              {unscheduled.map((todo) => (
                <li
                  key={todo.id}
                  draggable
                  onDragStart={() => setDragId(todo.id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId) reorderTodos(dragId, todo.id, selected);
                    setDragId(null);
                  }}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-zinc-800 hover:bg-zinc-800/30",
                    dragId === todo.id && "opacity-40",
                  )}
                >
                  <GripVertical
                    size={15}
                    className="cursor-grab text-zinc-700 group-hover:text-zinc-500"
                  />
                  <Checkbox
                    done={todo.done}
                    onClick={() => patchTodo(todo.id, { done: !todo.done })}
                  />
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      todo.done ? "text-zinc-600 line-through" : "text-zinc-100",
                    )}
                  >
                    {todo.text}
                  </span>
                  <GoalBadge goalId={todo.goalId} />
                  <button
                    type="button"
                    onClick={() => setScheduling({ initial: todo, isNew: false })}
                    title="Block time"
                    className="rounded p-1 text-zinc-700 opacity-0 transition-colors hover:text-indigo-300 group-hover:opacity-100"
                  >
                    <Clock size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePriority(todo)}
                    title={
                      todo.priority
                        ? "Unstar"
                        : "Star as one of today's 3 that matter"
                    }
                    className={cn(
                      "rounded p-1 transition-colors",
                      todo.priority
                        ? "text-amber-400"
                        : "text-zinc-700 hover:text-zinc-400",
                    )}
                  >
                    <Star size={14} fill={todo.priority ? "currentColor" : "none"} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTodo(todo.id)}
                    className="rounded p-1 text-zinc-700 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Scheduled time blocks */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-300">Schedule</h3>
            <button
              type="button"
              onClick={() =>
                setScheduling({ initial: blankScheduledTodo(selected), isNew: true })
              }
              className="inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <Plus size={13} /> Time block
            </button>
          </div>
          {scheduled.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No time blocks yet"
              subtitle="Click the clock on a task, or add a block."
            />
          ) : (
            <ul className="space-y-2">
              {scheduled.map((todo) => (
                <ScheduledBlock
                  key={todo.id}
                  todo={todo}
                  onEdit={() => setScheduling({ initial: todo, isNew: false })}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {scheduling && (
        <ScheduleModal
          initial={scheduling.initial}
          isNew={scheduling.isNew}
          onClose={() => setScheduling(null)}
        />
      )}
    </section>
  );
}

function GoalBadge({ goalId }: { goalId?: string }) {
  const goals = useSlice("goals");
  if (!goalId) return null;
  const goal = goals.find((g) => g.id === goalId);
  if (!goal) return null;
  return (
    <span
      title={`Goal: ${goal.title || "Untitled goal"}`}
      className="inline-flex max-w-[45%] shrink-0 items-center gap-1 rounded-full bg-indigo-400/10 px-2 py-0.5 text-[11px] text-indigo-300/90"
    >
      <Target size={11} className="shrink-0" />
      <span className="truncate">{goal.title || "Untitled goal"}</span>
    </span>
  );
}

function PrioritySection({ priority }: { priority: Todo[] }) {
  return (
    <Card className="mb-4 border-indigo-400/25 bg-indigo-400/[0.04] p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-indigo-200/90">
        <Star size={15} className="text-amber-400" fill="currentColor" /> The 3 that
        matter today
      </h3>
      {priority.length === 0 ? (
        <p className="text-xs text-zinc-500">
          Star up to {MAX_PRIORITY} tasks below to set today's focus.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {priority.map((todo) => (
            <li
              key={todo.id}
              className="flex items-center gap-3 rounded-lg border border-indigo-400/15 bg-zinc-900/40 px-3 py-2.5"
            >
              <Checkbox
                done={todo.done}
                onClick={() => patchTodo(todo.id, { done: !todo.done })}
              />
              <span
                className={cn(
                  "flex-1 text-[15px]",
                  todo.done ? "text-zinc-600 line-through" : "text-zinc-100",
                )}
              >
                {todo.text}
              </span>
              <button
                type="button"
                onClick={() => togglePriority(todo)}
                title="Unstar"
                className="rounded p-1 text-amber-400 transition-transform hover:scale-110"
              >
                <Star size={15} fill="currentColor" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ScheduledBlock({ todo, onEdit }: { todo: Todo; onEdit: () => void }) {
  const start = todo.startMin ?? 0;
  const gcal = googleCalendarUrl(todo);
  return (
    <li className="group flex items-stretch gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-md bg-zinc-800/60 px-1 py-1 text-center">
        <span className="text-xs font-semibold text-zinc-200">
          {timeLabel(start)}
        </span>
        <span className="text-[10px] text-zinc-500">
          {durationLabel(todo.durationMin ?? 0)}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Checkbox
          done={todo.done}
          onClick={() => patchTodo(todo.id, { done: !todo.done })}
        />
        <span
          className={cn(
            "flex-1 truncate text-sm",
            todo.done ? "text-zinc-600 line-through" : "text-zinc-100",
          )}
        >
          {todo.text}
        </span>
        <GoalBadge goalId={todo.goalId} />
        {gcal && (
          <a
            href={gcal}
            target="_blank"
            rel="noopener noreferrer"
            title="Add to Google Calendar"
            className="rounded p-1 text-zinc-600 opacity-0 transition-colors hover:text-indigo-300 group-hover:opacity-100"
          >
            <CalendarPlus size={14} />
          </a>
        )}
        <button
          type="button"
          onClick={onEdit}
          title="Edit time"
          className="rounded p-1 text-zinc-600 opacity-0 transition-colors hover:text-zinc-300 group-hover:opacity-100"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={() => removeTodo(todo.id)}
          className="rounded p-1 text-zinc-600 opacity-0 transition-colors hover:text-red-400 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}

function ScheduleModal({
  initial,
  isNew,
  onClose,
}: {
  initial: Todo;
  isNew: boolean;
  onClose: () => void;
}) {
  const goals = useSlice("goals");
  const [text, setText] = useState(initial.text);
  const [start, setStart] = useState(initial.startMin ?? 9 * 60);
  const [duration, setDuration] = useState(initial.durationMin ?? 60);
  const [goalId, setGoalId] = useState<string>(initial.goalId ?? "");

  const ready = text.trim().length > 0;

  function save() {
    if (!ready) return;
    const linkedGoal = goalId || undefined;
    if (isNew) {
      createScheduledTodo(text, initial.date, start, duration, linkedGoal);
    } else {
      patchTodo(initial.id, {
        text: text.trim(),
        startMin: clampMinutes(start),
        durationMin: duration,
        goalId: linkedGoal,
      });
    }
    onClose();
  }

  const sortedGoals = [...goals].sort(
    (a, b) =>
      HORIZONS.findIndex((h) => h.value === a.horizon) -
      HORIZONS.findIndex((h) => h.value === b.horizon),
  );

  return (
    <Modal open onClose={onClose} title={isNew ? "New time block" : "Edit time block"}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Task
          </label>
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            placeholder="What will you work on?"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Start
            </label>
            <input
              type="time"
              value={toTimeInput(start)}
              onChange={(e) => {
                const m = fromTimeInput(e.target.value);
                if (m != null) setStart(m);
              }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-400/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-400/50 focus:outline-none"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {durationLabel(d)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Linked goal (optional)
          </label>
          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-400/50 focus:outline-none"
          >
            <option value="">No linked goal</option>
            {sortedGoals.map((g) => (
              <option key={g.id} value={g.id}>
                {HORIZONS.find((h) => h.value === g.horizon)?.label} ·{" "}
                {g.title || "Untitled goal"}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-zinc-600">
          Starts {timeLabel(start)} · {durationLabel(duration)}. Add it to Google
          Calendar from the block, or export the whole day as .ics.
        </p>
        <div className="flex items-center justify-between pt-1">
          {!isNew && initial.startMin != null ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                unscheduleTodo(initial.id);
                onClose();
              }}
            >
              Unschedule
            </Button>
          ) : (
            <span />
          )}
          <Button variant="primary" disabled={!ready} onClick={save}>
            {isNew ? "Add block" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Goals() {
  const goals = useSlice("goals");
  const [editing, setEditing] = useState<Goal | null>(null);

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        <Target size={15} className="text-indigo-400" /> Goals
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {HORIZONS.map((h) => {
          const list = goals
            .filter((g) => g.horizon === h.value)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          return (
            <div key={h.value} className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-zinc-200">{h.label}</h3>
                <span className="text-xs text-zinc-600">{h.hint}</span>
              </div>
              {list.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onEdit={() => setEditing(goal)} />
              ))}
              <button
                type="button"
                onClick={() => setEditing(blankGoal(h.value))}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-800 py-2.5 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
              >
                <Plus size={14} /> Add goal
              </button>
            </div>
          );
        })}
      </div>

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing.title ? "Edit goal" : "New goal"}
          className="max-w-xl"
        >
          <GoalForm
            initial={editing}
            onSave={(g) => {
              saveGoal(g);
              setEditing(null);
            }}
            onDelete={() => {
              deleteGoal(editing.id);
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </section>
  );
}

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const doneMs = goal.milestones.filter((m) => m.done).length;
  return (
    <Card
      className="cursor-pointer overflow-hidden transition-colors hover:border-zinc-700"
      onClick={onEdit}
    >
      {goal.image && (
        <img
          src={goal.image}
          alt=""
          className="h-24 w-full object-cover opacity-90"
        />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-white">{goal.title || "Untitled goal"}</h4>
          <Pencil size={13} className="mt-1 shrink-0 text-zinc-600" />
        </div>
        {goal.description && (
          <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
            {goal.description}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <ProgressBar value={goal.progress} className="h-1.5" />
          <span className="text-xs font-medium tabular-nums text-zinc-400">
            {goal.progress}%
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-600">
          {goal.milestones.length > 0 && (
            <span>
              {doneMs}/{goal.milestones.length} milestones
            </span>
          )}
          {goal.targetDate && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={11} /> {humanDate(goal.targetDate)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function GoalForm({
  initial,
  onSave,
  onDelete,
}: {
  initial: Goal;
  onSave: (goal: Goal) => void;
  onDelete: () => void;
}) {
  const [goal, setGoal] = useState<Goal>(initial);
  const [msText, setMsText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function patch(p: Partial<Goal>) {
    setGoal((g) => ({ ...g, ...p }));
  }

  function addMilestone() {
    const text = msText.trim();
    if (!text) return;
    const m: Milestone = { id: uid(), text, done: false };
    patch({ milestones: [...goal.milestones, m] });
    setMsText("");
  }

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    try {
      patch({ image: await fileToCompressedDataURL(file) });
    } catch {
      window.alert("Sorry — that image couldn't be loaded.");
    }
  }

  return (
    <div className="space-y-4">
      <input
        autoFocus
        value={goal.title}
        onChange={(e) => patch({ title: e.target.value })}
        placeholder="Goal title"
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
      />

      <textarea
        value={goal.description}
        onChange={(e) => patch({ description: e.target.value })}
        rows={2}
        placeholder="What does success look like?"
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Horizon
          </label>
          <select
            value={goal.horizon}
            onChange={(e) => patch({ horizon: e.target.value as GoalHorizon })}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-400/50 focus:outline-none"
          >
            {HORIZONS.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Target date
          </label>
          <input
            type="date"
            value={goal.targetDate ?? ""}
            onChange={(e) => patch({ targetDate: e.target.value || undefined })}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-400/50 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Progress — {goal.progress}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={goal.progress}
          onChange={(e) => patch({ progress: clamp(Number(e.target.value), 0, 100) })}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Milestones
        </label>
        <ul className="mb-2 space-y-1">
          {goal.milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  patch({
                    milestones: goal.milestones.map((x) =>
                      x.id === m.id ? { ...x, done: !x.done } : x,
                    ),
                  })
                }
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded border-2",
                  m.done ? "border-transparent bg-indigo-400" : "border-zinc-600",
                )}
              >
                {m.done && <Check size={10} className="text-zinc-950" strokeWidth={3} />}
              </button>
              <span
                className={cn(
                  "flex-1 text-sm",
                  m.done ? "text-zinc-600 line-through" : "text-zinc-300",
                )}
              >
                {m.text}
              </span>
              <button
                type="button"
                onClick={() =>
                  patch({ milestones: goal.milestones.filter((x) => x.id !== m.id) })
                }
                className="text-zinc-700 hover:text-red-400"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
        <input
          value={msText}
          onChange={(e) => setMsText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addMilestone();
            }
          }}
          placeholder="Add a milestone…"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Motivational image
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPickImage(e.target.files?.[0])}
        />
        {goal.image ? (
          <div className="relative">
            <img src={goal.image} alt="" className="h-32 w-full rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => patch({ image: undefined })}
              className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white hover:bg-black/80"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 py-6 text-sm text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
          >
            <ImagePlus size={16} /> Upload an image
          </button>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button variant="danger" size="sm" onClick={onDelete}>
          <Trash2 size={14} /> Delete
        </Button>
        <Button
          variant="primary"
          disabled={!goal.title.trim()}
          onClick={() => onSave(goal)}
        >
          Save goal
        </Button>
      </div>
    </div>
  );
}
