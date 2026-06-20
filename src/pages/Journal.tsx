import { ChevronDown, Hash, NotebookPen, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AutoTextarea } from "../components/ui/AutoTextarea";
import { Button } from "../components/ui/Button";
import { Tag } from "../components/ui/Tag";
import { cn } from "../lib/cn";
import { humanDate, longDate, todayKey } from "../lib/dates";
import { updateSlice, useSlice } from "../lib/store";
import type { JournalEntry } from "../types";

const PROMPTS = [
  "What did I do today?",
  "What did I learn?",
  "What did I think about?",
  "What am I grateful for?",
];

function saveEntry(date: string, content: string, tags: string[]) {
  updateSlice("journal", (journal) => {
    // Don't persist a fully empty entry.
    if (!content.trim() && tags.length === 0) {
      if (!journal[date]) return journal;
      const next = { ...journal };
      delete next[date];
      return next;
    }
    return {
      ...journal,
      [date]: { date, content, tags, updatedAt: new Date().toISOString() },
    };
  });
}

function deleteEntry(date: string) {
  updateSlice("journal", (journal) => {
    const next = { ...journal };
    delete next[date];
    return next;
  });
}

export default function Journal() {
  const journal = useSlice("journal");
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
        e.content.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [sorted, search]);

  return (
    <div>
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
                  {entry.content.trim().split("\n")[0] || "—"}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Editor */}
        <Editor key={selected} date={selected} entry={journal[selected]} />
      </div>
    </div>
  );
}

function Editor({ date, entry }: { date: string; entry?: JournalEntry }) {
  const [content, setContent] = useState(entry?.content ?? "");
  const [tags, setTags] = useState<string[]>(entry?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [showPrompts, setShowPrompts] = useState(true);

  // Debounced auto-save on every change.
  useEffect(() => {
    const t = setTimeout(() => saveEntry(date, content, tags), 500);
    return () => clearTimeout(t);
  }, [content, tags, date]);

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const isToday = date === todayKey();

  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-start justify-between gap-3">
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
                setContent("");
                setTags([]);
              }
            }}
          >
            <Trash2 size={14} /> Delete
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowPrompts((s) => !s)}
        className="mb-2 flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
      >
        <ChevronDown
          size={13}
          className={cn("transition-transform", !showPrompts && "-rotate-90")}
        />
        Prompts
      </button>
      {showPrompts && (
        <ul className="mb-4 space-y-0.5 rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3 text-sm text-zinc-500">
          {PROMPTS.map((p) => (
            <li key={p}>· {p}</li>
          ))}
        </ul>
      )}

      <AutoTextarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Start writing…"
        className="min-h-[40vh] rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
      />

      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {tags.map((t) => (
            <Tag key={t} onRemove={() => setTags(tags.filter((x) => x !== t))}>
              #{t}
            </Tag>
          ))}
          {tags.length === 0 && (
            <EmptyTagHint />
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

function EmptyTagHint() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
      <NotebookPen size={12} /> Tag this entry to find it later
    </span>
  );
}
