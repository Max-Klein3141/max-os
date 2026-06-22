import { Check, Eye, Lightbulb, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { humanDate } from "../lib/dates";
import {
  addLearningItem,
  markReviewed,
  removeLearningItem,
  rescheduleCard,
} from "../lib/spacedRep";
import { useSlice } from "../lib/store";
import type { SpacedRepCard } from "../types";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

/**
 * Capture a learning as a question + answer, so it can be actively recalled.
 * Each saved item is scheduled for spaced review (1, 2, 7, 14, 28 days).
 */
export function LearningCapture({
  dateKeyStr,
  routingHint = false,
}: {
  dateKeyStr: string;
  /** Show a one-line hint pointing raw captures here before the Knowledge Base. */
  routingHint?: boolean;
}) {
  const items = useSlice("learningItems");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const todays = items
    .filter((i) => i.sourceDate === dateKeyStr)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function submit() {
    if (addLearningItem(question, answer, dateKeyStr)) {
      setQuestion("");
      setAnswer("");
    }
  }

  const ready = Boolean(question.trim() && answer.trim());

  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        <Lightbulb size={15} className="text-indigo-400" /> Capture a learning
      </h2>
      <p className="mb-1 text-xs text-zinc-600">
        Phrase what you learned as a question and answer — you'll be quizzed on it
        in 1, 2, 7, 14, and 28 days.
      </p>
      {routingHint && (
        <p className="mb-3 text-xs text-zinc-500">
          Not sure where this goes? Start here. Promote it to the Knowledge Base
          once it's a principle.
        </p>
      )}
      {!routingHint && <div className="mb-3" />}
      <div className="space-y-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Question — e.g. “Why does spaced repetition beat cramming?”"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
        />
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder="Answer — the thing worth remembering."
          className="min-h-20 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
        />
        <div className="flex justify-end">
          <Button variant="primary" disabled={!ready} onClick={submit}>
            <Plus size={14} /> Add to review
          </Button>
        </div>
      </div>

      {todays.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-zinc-600">
            Captured today
          </p>
          <ul className="space-y-1.5">
            {todays.map((i) => (
              <li
                key={i.id}
                className="group flex items-start justify-between gap-2 rounded-lg border border-zinc-800/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-200">
                    {i.question}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{i.answer}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeLearningItem(i.id)}
                  aria-label="Remove learning"
                  className="shrink-0 text-zinc-700 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** A list of due recall cards. Renders nothing when there are none. */
export function RecallReview({ cards }: { cards: SpacedRepCard[] }) {
  if (cards.length === 0) return null;
  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        <RotateCcw size={15} className="text-indigo-400" /> Recall review
      </h2>
      <p className="mb-4 text-sm text-zinc-500">
        {cards.length} learning{cards.length > 1 ? "s" : ""} due for review.
      </p>
      <div className="space-y-3">
        {cards.map((card) => (
          <ReviewCard key={card.id} card={card} />
        ))}
      </div>
    </Card>
  );
}

function ReviewCard({ card }: { card: SpacedRepCard }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      {card.question ? (
        <p className="text-[15px] font-medium leading-snug text-zinc-100">
          {card.question}
          <span className="ml-2 align-middle text-xs font-normal text-zinc-600">
            from {humanDate(card.sourceDate)} · +{card.interval}d
          </span>
        </p>
      ) : (
        <p className="text-sm text-zinc-400">
          What did you learn on{" "}
          <span className="font-medium text-zinc-200">
            {humanDate(card.sourceDate)}
          </span>
          ? <span className="text-zinc-600">(+{card.interval}d)</span>
        </p>
      )}
      {shown ? (
        <>
          <p className="mt-2 whitespace-pre-wrap text-zinc-300">{card.learning}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => markReviewed(card.id)}>
              <Check size={14} /> Got it
            </Button>
            <Button size="sm" onClick={() => rescheduleCard(card.id)}>
              <RotateCcw size={14} /> Needs work
            </Button>
          </div>
        </>
      ) : (
        <Button size="sm" className="mt-3" onClick={() => setShown(true)}>
          <Eye size={14} /> {card.question ? "Show answer" : "Show me"}
        </Button>
      )}
    </div>
  );
}
