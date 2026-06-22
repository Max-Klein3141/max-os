import { format, parseISO } from "date-fns";
import { Brain, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { PageHeader } from "../components/PageHeader";
import { AutoTextarea } from "../components/ui/AutoTextarea";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Tag } from "../components/ui/Tag";
import { cn } from "../lib/cn";
import { clearKnowledgeDraft, peekKnowledgeDraft } from "../lib/knowledgeDraft";
import { uid, updateSlice, useSlice } from "../lib/store";
import type { KnowledgeEntry, KnowledgeSourceType } from "../types";

const SOURCE_TYPES: { value: KnowledgeSourceType; label: string }[] = [
  { value: "book", label: "Book" },
  { value: "article", label: "Article" },
  { value: "conversation", label: "Conversation" },
  { value: "experience", label: "Experience" },
  { value: "idea", label: "Idea" },
  { value: "other", label: "Other" },
];

function sourceLabel(t: KnowledgeSourceType) {
  return SOURCE_TYPES.find((s) => s.value === t)?.label ?? "Other";
}

function saveEntry(entry: KnowledgeEntry) {
  updateSlice("knowledge", (list) =>
    list.some((e) => e.id === entry.id)
      ? list.map((e) => (e.id === entry.id ? entry : e))
      : [entry, ...list],
  );
}

function deleteEntry(id: string) {
  updateSlice("knowledge", (list) => list.filter((e) => e.id !== id));
}

function blankEntry(): KnowledgeEntry {
  return {
    id: uid(),
    title: "",
    body: "",
    tags: [],
    sourceType: "idea",
    createdAt: new Date().toISOString(),
  };
}

export default function Knowledge() {
  const entries = useSlice("knowledge");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<KnowledgeSourceType | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  // If we arrived here via "Promote to Knowledge Base", open the New entry form
  // pre-filled with the promoted learning's content. Peek during init (pure,
  // StrictMode-safe) and clear the one-shot draft in an effect.
  const [editing, setEditing] = useState<KnowledgeEntry | null>(() => {
    const draft = peekKnowledgeDraft();
    return draft ? { ...blankEntry(), ...draft } : null;
  });
  const [viewing, setViewing] = useState<KnowledgeEntry | null>(null);

  useEffect(() => {
    clearKnowledgeDraft();
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) for (const t of e.tags) set.add(t);
    return [...set].sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => typeFilter === "all" || e.sourceType === typeFilter)
      .filter((e) => !tagFilter || e.tags.includes(tagFilter))
      .filter(
        (e) =>
          !q ||
          e.title.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q) ||
          (e.source ?? "").toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [entries, search, typeFilter, tagFilter]);

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        subtitle="Refined principles — your best permanent thinking."
        actions={
          <Button variant="primary" onClick={() => setEditing(blankEntry())}>
            <Plus size={15} /> New entry
          </Button>
        }
      />

      {/* Controls */}
      <div className="mb-5 space-y-3">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your knowledge…"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterPill active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
            All sources
          </FilterPill>
          {SOURCE_TYPES.map((s) => (
            <FilterPill
              key={s.value}
              active={typeFilter === s.value}
              onClick={() => setTypeFilter(s.value)}
            >
              {s.label}
            </FilterPill>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {allTags.map((t) => (
              <Tag
                key={t}
                active={tagFilter === t}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
              >
                #{t}
              </Tag>
            ))}
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={Brain}
            title="Your knowledge base is empty"
            subtitle="Capture an insight, lesson, or idea worth keeping forever."
            action={
              <Button variant="primary" onClick={() => setEditing(blankEntry())}>
                <Plus size={15} /> New entry
              </Button>
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-600">
          No entries match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry) => (
            <Card
              key={entry.id}
              onClick={() => setViewing(entry)}
              className="cursor-pointer p-4 transition-colors hover:border-zinc-700"
            >
              <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-600">
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-medium text-zinc-400">
                  {sourceLabel(entry.sourceType)}
                </span>
                <span>{format(parseISO(entry.createdAt), "MMM d, yyyy")}</span>
              </div>
              <h3 className="font-semibold text-white">{entry.title}</h3>
              <p className="mt-1 line-clamp-3 text-sm text-zinc-500">{entry.body}</p>
              {entry.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {entry.tags.map((t) => (
                    <Tag key={t}>#{t}</Tag>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Detail view */}
      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.title}
        className="max-w-2xl"
      >
        {viewing && (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-medium text-zinc-400">
                {sourceLabel(viewing.sourceType)}
              </span>
              {viewing.source && <span>{viewing.source}</span>}
              <span>· {format(parseISO(viewing.createdAt), "MMMM d, yyyy")}</span>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed text-zinc-200">
              {viewing.body}
            </p>
            {viewing.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {viewing.tags.map((t) => (
                  <Tag key={t}>#{t}</Tag>
                ))}
              </div>
            )}
            <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4">
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (window.confirm("Delete this entry?")) {
                    deleteEntry(viewing.id);
                    setViewing(null);
                  }
                }}
              >
                <Trash2 size={14} /> Delete
              </Button>
              <Button
                onClick={() => {
                  setEditing(viewing);
                  setViewing(null);
                }}
              >
                Edit
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create / edit form */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.title ? "Edit entry" : "New entry"}
        className="max-w-2xl"
      >
        {editing && (
          <KnowledgeForm
            initial={editing}
            onSave={(e) => {
              saveEntry(e);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-zinc-600 bg-zinc-800 text-white"
          : "border-zinc-800 text-zinc-500 hover:text-zinc-300",
      )}
    >
      {children}
    </button>
  );
}

function KnowledgeForm({
  initial,
  onSave,
}: {
  initial: KnowledgeEntry;
  onSave: (entry: KnowledgeEntry) => void;
}) {
  const [entry, setEntry] = useState<KnowledgeEntry>(initial);
  const [tagInput, setTagInput] = useState("");

  function patch(p: Partial<KnowledgeEntry>) {
    setEntry((e) => ({ ...e, ...p }));
  }

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (t && !entry.tags.includes(t)) patch({ tags: [...entry.tags, t] });
    setTagInput("");
  }

  return (
    <div className="space-y-4">
      <input
        autoFocus
        value={entry.title}
        onChange={(e) => patch({ title: e.target.value })}
        placeholder="Title"
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
      />

      <AutoTextarea
        value={entry.body}
        onChange={(e) => patch({ body: e.target.value })}
        placeholder="The insight, in your own words…"
        className="min-h-32 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Source type
          </label>
          <select
            value={entry.sourceType}
            onChange={(e) =>
              patch({ sourceType: e.target.value as KnowledgeSourceType })
            }
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-400/50 focus:outline-none"
          >
            {SOURCE_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Source (optional)
          </label>
          <input
            value={entry.source ?? ""}
            onChange={(e) => patch({ source: e.target.value || undefined })}
            placeholder="e.g. Zero to One"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Tags
        </label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {entry.tags.map((t) => (
            <Tag
              key={t}
              onRemove={() => patch({ tags: entry.tags.filter((x) => x !== t) })}
            >
              #{t}
            </Tag>
          ))}
        </div>
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
          placeholder="Add tag and press Enter…"
          className="w-full max-w-xs rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
        />
      </div>

      <div className="flex justify-end pt-1">
        <Button
          variant="primary"
          disabled={!entry.title.trim() || !entry.body.trim()}
          onClick={() => onSave(entry)}
        >
          Save entry
        </Button>
      </div>
    </div>
  );
}
