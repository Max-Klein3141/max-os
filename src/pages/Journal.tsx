import { format } from "date-fns";
import {
  Hash,
  Library as LibraryIcon,
  NotebookPen,
  PenLine,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ReminderBanner } from "../components/ReminderBanner";
import { AutoTextarea } from "../components/ui/AutoTextarea";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Tag } from "../components/ui/Tag";
import { cn } from "../lib/cn";
import { humanDate, longDate, parseKey, todayKey } from "../lib/dates";
import { updateSlice, useSlice } from "../lib/store";
import * as db from "../lib/db";
import type { JournalEntry } from "../types";

type JournalPrompt = { key: string; label: string; placeholder: string };

// Monday looks ahead, Sunday looks back, every other day reflects on the day.
// Keys are stable per day-of-week so an entry always maps to the same fields;
// weekday keys match the original set so older entries still display.
const MONDAY_PROMPTS: JournalPrompt[] = [
  { key: "monPriority", label: "What's my #1 priority this week?", placeholder: "The one thing that matters most." },
  { key: "monSuccess", label: "What would make this week a success?", placeholder: "Picture Friday — what's true?" },
  { key: "monProtect", label: "What do I need to protect time for?", placeholder: "Guard it before the week fills up." },
  { key: "monGrateful", label: "What am I grateful for entering this week?", placeholder: "Start from abundance." },
];

const SUNDAY_PROMPTS: JournalPrompt[] = [
  { key: "sunDefined", label: "What defined this week?", placeholder: "The moments that stood out." },
  { key: "sunDifferent", label: "What's one thing I'd do differently?", placeholder: "An honest second look." },
  { key: "sunCarry", label: "What am I carrying into next week?", placeholder: "Momentum, lessons, intentions." },
  { key: "sunProud", label: "What am I most proud of?", placeholder: "Give yourself credit." },
  { key: "sunSelf", label: "What is one belief or behavior I want to strengthen next week?", placeholder: "Name it — then act on it." },
];

const OTHER_PROMPTS: JournalPrompt[] = [
  { key: "wentWell", label: "What's one thing I did that moved me forward?", placeholder: "A step, however small." },
  { key: "didntGo", label: "What didn't go to plan — and why?", placeholder: "Friction, mistakes, what felt off." },
  { key: "learned", label: "What did I learn today?", placeholder: "An insight, a lesson, something new." },
  { key: "grateful", label: "What am I grateful for?", placeholder: "Big or small…" },
  { key: "notes", label: "What's on my mind?", placeholder: "Free space to think out loud." },
];

/** Day-aware prompt set for an entry, based on its date's day of week. */
function journalPrompts(date: string): JournalPrompt[] {
  const day = parseKey(date).getDay(); // 0 = Sun, 1 = Mon
  if (day === 0) return SUNDAY_PROMPTS;
  if (day === 1) return MONDAY_PROMPTS;
  return OTHER_PROMPTS;
}

/** Combined text of an entry, for snippets and search (handles legacy entries). */
function entryText(e: JournalEntry): string {
  const parts = [e.content ?? "", ...Object.values(e.sections ?? {})];
  return parts.filter(Boolean).join("\n").trim();
}

function saveEntry(
  date: string,
  sections: Record<string, string>,
  tags: string[],
  goalProgress: Record<string, string>,
) {
  updateSlice("journal", (journal) => {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(sections)) if (v.trim()) clean[k] = v;
    const cleanGoals: Record<string, string> = {};
    for (const [k, v] of Object.entries(goalProgress)) if (v.trim()) cleanGoals[k] = v;
    const hasGoals = Object.keys(cleanGoals).length > 0;
    const hasText = Object.keys(clean).length > 0;

    if (!hasText && !hasGoals && tags.length === 0) {
      if (!journal[date]) return journal;
      const next = { ...journal };
      delete next[date];
      return next;
    }
    // Note: legacy `content` is intentionally dropped here — it was migrated
    // into `sections` when the editor opened.
    const entry: JournalEntry = {
      date,
      sections: clean,
      goalProgress: cleanGoals,
      tags,
      updatedAt: new Date().toISOString(),
    };
    
    // Sync to Supabase in the background
    db.saveJournalEntry(date, entry).catch(err => console.error("Failed to sync journal entry to Supabase:", err));
    
    return {
      ...journal,
      [date]: entry,
    };
  });
}

function deleteEntry(date: string) {
  updateSlice("journal", (journal) => {
    const next = { ...journal };
    delete next[date];
    return next;
  });
  
  // Sync deletion to Supabase in the background
  db.saveJournalEntry(date, { date, sections: {}, tags: [], updatedAt: new Date().toISOString() })
    .catch(err => console.error("Failed to sync journal deletion to Supabase:", err));
}

export default function Journal() {
  const journal = useSlice("journal");
  const [mode, setMode] = useState<"write" | "library">("write");
  const [selected, setSelected] = useState(todayKey());
  const [search, setSearch] = useState("");

  const sorted = useMemo(
    () => Object.values(journal).sort((a, b) => b.date.localeCompare(a.date)),
    [journal],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (e) =>
        entryText(e).toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [sorted, search]);

  function openEntry(date: string) {
    setSelected(date);
    setMode("write");
  }

  const todayEntry = journal[todayKey()];
  const journaledToday = Boolean(
    todayEntry &&
      Object.values(todayEntry.sections ?? {}).some((v) => v.trim()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Journal</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {sorted.length} {sorted.length === 1 ? "entry" : "entries"} · one per day
          </p>
        </div>
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/50 p-0.5">
          <ModeTab active={mode === "write"} icon={PenLine} onClick={() => setMode("write")}>
            Write
          </ModeTab>
          <ModeTab
            active={mode === "library"}
            icon={LibraryIcon}
            onClick={() => setMode("library")}
          >
            Library
          </ModeTab>
        </div>
      </div>

      {!journaledToday && (
        <ReminderBanner
          icon={PenLine}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openEntry(todayKey())}
            >
              Write it
            </Button>
          }
        >
          You haven't written today's journal entry.
        </ReminderBanner>
      )}

      {mode === "library" ? (
        <Library
          entries={filtered}
          search={search}
          onSearch={setSearch}
          onOpen={openEntry}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          {/* Entry list */}
          <aside className="space-y-3">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entries…"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
              />
            </div>

            <Button
              variant={selected === todayKey() ? "primary" : "secondary"}
              className="w-full"
              onClick={() => setSelected(todayKey())}
            >
              <Plus size={15} /> Today's entry
            </Button>

            <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
              {filtered.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-zinc-600">
                  {search ? "No matching entries." : "No entries yet."}
                </p>
              )}
              {filtered.map((entry) => (
                <button
                  key={entry.date}
                  type="button"
                  onClick={() => setSelected(entry.date)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                    selected === entry.date
                      ? "border-zinc-700 bg-zinc-800/60"
                      : "border-transparent hover:bg-zinc-800/30",
                  )}
                >
                  <div className="text-sm font-medium text-zinc-200">
                    {humanDate(entry.date)}
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {entryText(entry).split("\n")[0] || "—"}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Editor */}
          <Editor key={selected} date={selected} entry={journal[selected]} />
        </div>
      )}
    </div>
  );
}

function ModeTab({
  active,
  icon: Icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200",
      )}
    >
      <Icon size={14} /> {children}
    </button>
  );
}

function Library({
  entries,
  search,
  onSearch,
  onOpen,
}: {
  entries: JournalEntry[];
  search: string;
  onSearch: (value: string) => void;
  onOpen: (date: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const entry of entries) {
      const label = format(parseKey(entry.date), "MMMM yyyy");
      const bucket = map.get(label);
      if (bucket) bucket.push(entry);
      else map.set(label, [entry]);
    }
    return [...map.entries()];
  }, [entries]);

  return (
    <div>
      <div className="relative mb-6 max-w-md">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
        />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search all entries…"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
        />
      </div>

      {entries.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={NotebookPen}
            title={search ? "No matching entries" : "No entries yet"}
            subtitle={
              search
                ? "Try a different search term."
                : "Entries you write will be archived here, newest first."
            }
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map(([label, items]) => (
            <section key={label}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  {label}
                </h2>
                <span className="text-xs text-zinc-600">
                  {items.length} {items.length === 1 ? "entry" : "entries"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((entry) => (
                  <LibraryCard
                    key={entry.date}
                    entry={entry}
                    onOpen={() => onOpen(entry.date)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function LibraryCard({
  entry,
  onOpen,
}: {
  entry: JournalEntry;
  onOpen: () => void;
}) {
  const text = entryText(entry);
  const words = text ? text.split(/\s+/).length : 0;
  return (
    <Card
      onClick={onOpen}
      className="cursor-pointer p-4 transition-colors hover:border-zinc-700"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium text-zinc-100">
          {format(parseKey(entry.date), "EEE, MMM d")}
        </h3>
        <span className="shrink-0 text-[11px] text-zinc-600">
          {words} {words === 1 ? "word" : "words"}
        </span>
      </div>
      <p className="mt-1 line-clamp-3 text-sm text-zinc-500">{text || "—"}</p>
      {entry.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {entry.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function Editor({ date, entry }: { date: string; entry?: JournalEntry }) {
  const goals = useSlice("goals");
  const [sections, setSections] = useState<Record<string, string>>(() => {
    const init = { ...(entry?.sections ?? {}) };
    // Migrate any legacy freeform body into the catch-all field.
    if (entry?.content && !init.notes) init.notes = entry.content;
    return init;
  });
  const [goalProgress, setGoalProgress] = useState<Record<string, string>>(
    () => ({ ...(entry?.goalProgress ?? {}) }),
  );
  const [tags, setTags] = useState<string[]>(entry?.tags ?? []);
  const [tagInput, setTagInput] = useState("");

  // Debounced auto-save on every change.
  useEffect(() => {
    const t = setTimeout(
      () => saveEntry(date, sections, tags, goalProgress),
      500,
    );
    return () => clearTimeout(t);
  }, [sections, tags, goalProgress, date]);

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }

  function setField(key: string, value: string) {
    setSections((s) => ({ ...s, [key]: value }));
  }

  function setGoalField(goalId: string, value: string) {
    setGoalProgress((g) => ({ ...g, [goalId]: value }));
  }

  const text = Object.values(sections).join(" ").trim();
  const words = text ? text.split(/\s+/).length : 0;
  const isToday = date === todayKey();

  return (
    <div className="min-w-0">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {isToday ? longDate(new Date()) : humanDate(date)}
          </h1>
          <p className="mt-0.5 text-xs text-zinc-600">
            {words} word{words === 1 ? "" : "s"}
            {entry && " · auto-saved"}
          </p>
        </div>
        {entry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm("Delete this entry?")) {
                deleteEntry(date);
                setSections({});
                setTags([]);
              }
            }}
          >
            <Trash2 size={14} /> Delete
          </Button>
        )}
      </div>

      <div className="space-y-5">
        {journalPrompts(date).map((p) => (
          <div key={p.key}>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              {p.label}
            </label>
            <AutoTextarea
              value={sections[p.key] ?? ""}
              onChange={(e) => setField(p.key, e.target.value)}
              placeholder={p.placeholder}
              className="min-h-[3.5rem] rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
            />
          </div>
        ))}

        {goals.map((g) => (
          <div key={g.id}>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              What did I do this week toward:{" "}
              <span className="text-indigo-300">{g.title || "Untitled goal"}</span>?
            </label>
            <AutoTextarea
              value={goalProgress[g.id] ?? ""}
              onChange={(e) => setGoalField(g.id, e.target.value)}
              placeholder="Progress, however small…"
              className="min-h-[3.5rem] rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
            />
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {tags.map((t) => (
            <Tag key={t} onRemove={() => setTags(tags.filter((x) => x !== t))}>
              #{t}
            </Tag>
          ))}
          {tags.length === 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
              <NotebookPen size={12} /> Tag this entry to find it later
            </span>
          )}
        </div>
        <div className="relative max-w-xs">
          <Hash
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
          />
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
            placeholder="Add tag…"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-1.5 pl-8 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
