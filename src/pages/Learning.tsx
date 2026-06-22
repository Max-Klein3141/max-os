import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  Eye,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { LearningCapture, RecallReview } from "../components/learning";
import { PageHeader } from "../components/PageHeader";
import { ReminderBanner } from "../components/ReminderBanner";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { humanDate, todayKey } from "../lib/dates";
import { setKnowledgeDraft } from "../lib/knowledgeDraft";
import { dueCards } from "../lib/spacedRep";
import { useDatabase } from "../lib/store";
import type { KnowledgeEntry, SpacedRepCard } from "../types";
import type { ViewKey } from "../views";

/** A learning-log row: a Q&A item, or a legacy freeform "today I learned" note. */
type LogEntry =
  | { kind: "qa"; id: string; date: string; question: string; answer: string }
  | { kind: "text"; id: string; date: string; text: string };

export default function Learning({
  onNavigate,
}: {
  onNavigate: (key: ViewKey) => void;
}) {
  const db = useDatabase();
  const key = todayKey();

  function promote(entry: LogEntry) {
    if (entry.kind === "qa") {
      setKnowledgeDraft({ title: entry.question, body: entry.answer });
    } else {
      const firstLine = entry.text.split("\n")[0].slice(0, 80);
      setKnowledgeDraft({ title: firstLine || "Learning", body: entry.text });
    }
    onNavigate("knowledge");
  }

  const due = dueCards(key);
  const upcoming = db.spacedRep
    .filter((c) => c.status === "pending" && c.dueDate > key)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 12);

  // The learning log merges Q&A items with any legacy "today I learned" notes.
  const qaEntries: LogEntry[] = db.learningItems.map((i) => ({
    kind: "qa",
    id: i.id,
    date: i.sourceDate,
    question: i.question,
    answer: i.answer,
  }));
  const legacyEntries: LogEntry[] = Object.values(db.dailyLogs)
    .filter((l) => l.learning && l.learning.trim())
    .map((l) => ({
      kind: "text",
      id: `log-${l.date}`,
      date: l.date,
      text: l.learning as string,
    }));
  const logEntries = [...qaEntries, ...legacyEntries].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );

  const learnedToday =
    db.learningItems.some((i) => i.sourceDate === key) ||
    Boolean(db.dailyLogs[key]?.learning?.trim());

  const revisit = db.knowledge
    .filter((e) => differenceInCalendarDays(new Date(), parseISO(e.createdAt)) >= 14)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning"
        subtitle="Raw captures — ideas still being processed. You'll be quizzed on these."
      />

      {!learnedToday && (
        <ReminderBanner icon={Lightbulb}>
          You haven't captured a learning today — add one below.
        </ReminderBanner>
      )}

      <LearningCapture dateKeyStr={key} />

      {due.length > 0 ? <RecallReview cards={due} /> : <CaughtUp />}

      {upcoming.length > 0 && <Upcoming cards={upcoming} />}

      <KnowledgeRevisit entries={revisit} />

      <LearningLog entries={logEntries} onPromote={promote} />
    </div>
  );
}

function CaughtUp() {
  return (
    <Card className="flex items-center gap-3 p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400">
        <Sparkles size={17} />
      </span>
      <div>
        <p className="text-sm font-medium text-zinc-200">No reviews due right now</p>
        <p className="text-xs text-zinc-500">
          You're all caught up. New reviews appear as your learnings come due.
        </p>
      </div>
    </Card>
  );
}

function Upcoming({ cards }: { cards: SpacedRepCard[] }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        <CalendarClock size={15} className="text-indigo-400" /> Coming up
      </h2>
      <ul className="space-y-2">
        {cards.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/60 px-3 py-2"
          >
            <span className="truncate text-sm text-zinc-300">
              {(c.question ?? c.learning).split("\n")[0]}
            </span>
            <span className="shrink-0 text-xs text-zinc-600">
              {humanDate(c.dueDate)} · +{c.interval}d
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function KnowledgeRevisit({ entries }: { entries: KnowledgeEntry[] }) {
  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        <BookOpen size={15} className="text-indigo-400" /> Revisit your knowledge
      </h2>
      <p className="mb-4 text-xs text-zinc-600">
        Older entries worth re-reading. Try to recall the idea before revealing.
      </p>
      {entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Nothing to revisit yet"
          subtitle="Knowledge base entries become available to review after two weeks."
        />
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <RevisitItem key={e.id} entry={e} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function RevisitItem({ entry }: { entry: KnowledgeEntry }) {
  const [shown, setShown] = useState(false);
  return (
    <li className="rounded-lg border border-zinc-800/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-200">{entry.title}</span>
        {!shown && (
          <Button size="sm" variant="ghost" onClick={() => setShown(true)}>
            <Eye size={13} /> Reveal
          </Button>
        )}
      </div>
      {shown && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">{entry.body}</p>
      )}
    </li>
  );
}

function LearningLog({
  entries,
  onPromote,
}: {
  entries: LogEntry[];
  onPromote: (entry: LogEntry) => void;
}) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        <Lightbulb size={15} className="text-indigo-400" /> Your learning log
      </h2>
      {entries.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No learnings logged yet"
          subtitle="Capture a question & answer above — it'll collect here over time."
        />
      ) : (
        <ul className="max-h-96 space-y-3 overflow-y-auto pr-1">
          {entries.map((e) => (
            <li key={e.id} className="group border-l-2 border-zinc-800 pl-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-zinc-600">{humanDate(e.date)}</div>
                <button
                  type="button"
                  onClick={() => onPromote(e)}
                  title="Promote to Knowledge Base"
                  className="inline-flex shrink-0 items-center gap-1 rounded text-[11px] font-medium text-zinc-600 opacity-0 transition-colors hover:text-indigo-300 focus:opacity-100 group-hover:opacity-100"
                >
                  <ArrowUpRight size={12} /> Promote to Knowledge Base
                </button>
              </div>
              {e.kind === "qa" ? (
                <>
                  <p className="mt-0.5 text-sm font-medium text-zinc-200">
                    {e.question}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-400">
                    {e.answer}
                  </p>
                </>
              ) : (
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-300">
                  {e.text}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
