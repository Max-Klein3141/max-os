import {
  CalendarClock,
  Check,
  Flag,
  GripVertical,
  ImagePlus,
  Pencil,
  Plus,
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
import { clamp, cn } from "../lib/cn";
import { humanDate, todayKey } from "../lib/dates";
import { fileToCompressedDataURL } from "../lib/image";
import { getDatabase, setSlice, uid, updateSlice, useSlice } from "../lib/store";
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

function addTodo(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const today = todayKey();
  const maxOrder = getDatabase()
    .todos.filter((t) => t.date === today)
    .reduce((m, t) => Math.max(m, t.order), -1);
  updateSlice("todos", (todos) => [
    ...todos,
    {
      id: uid(),
      text: trimmed,
      done: false,
      priority: false,
      date: today,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
    },
  ]);
}

function patchTodo(id: string, patch: Partial<Todo>) {
  updateSlice("todos", (todos) =>
    todos.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  );
}

function removeTodo(id: string) {
  updateSlice("todos", (todos) => todos.filter((t) => t.id !== id));
}

function reorderTodos(sourceId: string, targetId: string) {
  const today = todayKey();
  const all = getDatabase().todos;
  const todays = all
    .filter((t) => t.date === today)
    .sort((a, b) => a.order - b.order);
  const from = todays.findIndex((t) => t.id === sourceId);
  const to = todays.findIndex((t) => t.id === targetId);
  if (from < 0 || to < 0 || from === to) return;
  const reordered = [...todays];
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

// ── Goal helpers ─────────────────────────────────────────────────────────────

function saveGoal(goal: Goal) {
  updateSlice("goals", (goals) => {
    const exists = goals.some((g) => g.id === goal.id);
    return exists ? goals.map((g) => (g.id === goal.id ? goal : g)) : [...goals, goal];
  });
}

function deleteGoal(id: string) {
  updateSlice("goals", (goals) => goals.filter((g) => g.id !== id));
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

function DailyPlanner({ rolled }: { rolled: number }) {
  const todos = useSlice("todos");
  const [text, setText] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const today = todayKey();
  const todays = todos
    .filter((t) => t.date === today)
    .sort((a, b) => a.order - b.order);
  const remaining = todays.filter((t) => !t.done).length;

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          <Check size={15} className="text-indigo-400" /> Today's plan
        </h2>
        <span className="text-xs text-zinc-600">{remaining} left</span>
        {rolled > 0 && (
          <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-300">
            {rolled} rolled over
          </span>
        )}
      </div>

      <Card className="p-4">
        <div className="mb-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addTodo(text);
                setText("");
              }
            }}
            placeholder="Add a task and press Enter…"
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
          />
          <Button
            variant="primary"
            onClick={() => {
              addTodo(text);
              setText("");
            }}
          >
            <Plus size={15} />
          </Button>
        </div>

        {todays.length === 0 ? (
          <EmptyState
            icon={Check}
            title="Nothing planned yet"
            subtitle="Add your first task for today."
          />
        ) : (
          <ul className="space-y-1">
            {todays.map((todo) => (
              <li
                key={todo.id}
                draggable
                onDragStart={() => setDragId(todo.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) reorderTodos(dragId, todo.id);
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
                <button
                  type="button"
                  onClick={() => patchTodo(todo.id, { done: !todo.done })}
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                    todo.done
                      ? "border-transparent bg-indigo-400"
                      : "border-zinc-600 hover:border-zinc-400",
                  )}
                >
                  {todo.done && (
                    <Check size={13} className="text-zinc-950" strokeWidth={3} />
                  )}
                </button>
                <span
                  className={cn(
                    "flex-1 text-sm",
                    todo.done ? "text-zinc-600 line-through" : "text-zinc-100",
                  )}
                >
                  {todo.text}
                </span>
                <button
                  type="button"
                  onClick={() => patchTodo(todo.id, { priority: !todo.priority })}
                  title="Priority"
                  className={cn(
                    "rounded p-1 transition-colors",
                    todo.priority
                      ? "text-amber-400"
                      : "text-zinc-700 hover:text-zinc-400",
                  )}
                >
                  <Flag size={14} fill={todo.priority ? "currentColor" : "none"} />
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
    </section>
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
