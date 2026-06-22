import { addDays } from "date-fns";
import type { LearningItem, SpacedRepCard, SpacedRepStatus } from "../types";
import { dateKey, parseKey, todayKey } from "./dates";
import { getDatabase, uid, updateSlice } from "./store";

/** Active-recall reviews at 1, 2, 7, 14, and 28 days after learning. */
export const SPACED_INTERVALS = [1, 2, 7, 14, 28];

/** Days to push a card forward when the user marks "Needs work". */
export const RESCHEDULE_DAYS = 3;

/** Build the spaced-repetition cards for one learning item. */
function cardsForItem(item: LearningItem): SpacedRepCard[] {
  const createdAt = new Date().toISOString();
  return SPACED_INTERVALS.map((interval) => ({
    id: uid(),
    itemId: item.id,
    sourceDate: item.sourceDate,
    question: item.question,
    learning: item.answer,
    dueDate: dateKey(addDays(parseKey(item.sourceDate), interval)),
    interval,
    status: "pending" as SpacedRepStatus,
    createdAt,
  }));
}

/**
 * Save a question/answer the user learned and schedule its review cards.
 * Returns the new item, or null if either field is blank.
 */
export function addLearningItem(
  question: string,
  answer: string,
  sourceDate: string = todayKey(),
): LearningItem | null {
  const q = question.trim();
  const a = answer.trim();
  if (!q || !a) return null;
  const item: LearningItem = {
    id: uid(),
    question: q,
    answer: a,
    sourceDate,
    createdAt: new Date().toISOString(),
  };
  updateSlice("learningItems", (items) => [...items, item]);
  updateSlice("spacedRep", (cards) => [...cards, ...cardsForItem(item)]);
  return item;
}

/** Remove a learning item along with any of its outstanding review cards. */
export function removeLearningItem(id: string): void {
  updateSlice("learningItems", (items) => items.filter((i) => i.id !== id));
  updateSlice("spacedRep", (cards) => cards.filter((c) => c.itemId !== id));
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
