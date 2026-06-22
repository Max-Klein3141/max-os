import { startOfISOWeek, subDays } from "date-fns";
import type { WeeklyReview } from "../types";
import { isoWeekKey } from "./dates";

/** Whether a stored review actually has content (any field filled in). */
export function reviewHasContent(r?: WeeklyReview): boolean {
  if (!r) return false;
  return Boolean(
    r.word.trim() ||
      r.wins.trim() ||
      r.mistakes.trim() ||
      r.lessons.trim() ||
      r.goalsProgress.trim() ||
      r.focusNext.trim(),
  );
}

export type WeeklyReviewStatus =
  | { state: "ok" }
  | { state: "dueToday"; week: string }
  | { state: "missed"; week: string };

/**
 * Weekly reviews are meant to be done by Sunday — the last day of the ISO week.
 * Returns:
 *  - `dueToday` when it's Sunday and this week's review isn't written yet,
 *  - `missed` when a previous week ended with no review,
 *  - `ok` otherwise.
 * `missed` takes over from `dueToday` automatically: an un-done Sunday review
 * becomes "missed" once Monday rolls around.
 */
export function weeklyReviewStatus(
  reviews: Record<string, WeeklyReview>,
  asOf: Date = new Date(),
): WeeklyReviewStatus {
  const currentWeek = isoWeekKey(asOf);
  if (asOf.getDay() === 0 && !reviewHasContent(reviews[currentWeek])) {
    return { state: "dueToday", week: currentWeek };
  }
  // The previous ISO week ended on the Sunday just before this week's Monday.
  const prevWeek = isoWeekKey(subDays(startOfISOWeek(asOf), 1));
  if (!reviewHasContent(reviews[prevWeek])) {
    return { state: "missed", week: prevWeek };
  }
  return { state: "ok" };
}
