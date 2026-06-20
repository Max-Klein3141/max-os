import { addDays } from "date-fns";
import type { SpacedRepCard } from "../types";
import { dateKey, parseKey, todayKey } from "./dates";
import { getDatabase, setSlice, uid, updateSlice } from "./store";

/** Review the original learning 7, 14, and 30 days later. */
export const SPACED_INTERVALS = [7, 14, 30];

/** Days to push a card forward when the user marks "Needs work". */
export const RESCHEDULE_DAYS = 3;

/**
 * (Re)schedule spaced-repetition cards for a day's learning summary. Called
 * whenever a learning summary is saved. If the text is blank, any existing
 * cards for that source date are removed.
 */
export function scheduleForLearning(sourceDate: string, learning: string): void {
  const existing = getDatabase().spacedRep;
  const trimmed = learning.trim();
  const forDate = existing.filter((c) => c.sourceDate === sourceDate);

  if (!trimmed) {
    if (forDate.length) {
      setSlice(
        "spacedRep",
        existing.filter((c) => c.sourceDate !== sourceDate),
      );
    }
    return;
  }

  // Unchanged text → keep existing cards (and their review progress).
  if (forDate.length && forDate.every((c) => c.learning === trimmed)) return;

  const others = existing.filter((c) => c.sourceDate !== sourceDate);
  const createdAt = new Date().toISOString();
  const cards: SpacedRepCard[] = SPACED_INTERVALS.map((interval) => ({
    id: uid(),
    sourceDate,
    learning: trimmed,
    dueDate: dateKey(addDays(parseKey(sourceDate), interval)),
    interval,
    status: "pending",
    createdAt,
  }));
  setSlice("spacedRep", [...others, ...cards]);
}

/** Pending cards that are due on or before `asOf` (default: today). */
export function dueCards(asOf: string = todayKey()): SpacedRepCard[] {
  return getDatabase()
    .spacedRep.filter((c) => c.status === "pending" && c.dueDate <= asOf)
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) || a.interval - b.interval,
    );
}

export function markReviewed(id: string): void {
  updateSlice("spacedRep", (cards) =>
    cards.map((c) => (c.id === id ? { ...c, status: "done" } : c)),
  );
}

export function rescheduleCard(id: string, days: number = RESCHEDULE_DAYS): void {
  const due = dateKey(addDays(new Date(), days));
  updateSlice("spacedRep", (cards) =>
    cards.map((c) =>
      c.id === id ? { ...c, dueDate: due, status: "pending" } : c,
    ),
  );
}
