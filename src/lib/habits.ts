import { addDays, startOfDay, subDays } from "date-fns";
import type { Habit, HabitCategory, HabitFrequency, HabitLogs } from "../types";
import { setSlice, uid, updateSlice, getDatabase } from "./store";
import { dateKey } from "./dates";

export const HABIT_CATEGORIES: { value: HabitCategory; label: string }[] = [
  { value: "health", label: "Health" },
  { value: "mind", label: "Mind" },
  { value: "work", label: "Work" },
  { value: "relationships", label: "Relationships" },
  { value: "custom", label: "Custom" },
];

/** Default accent palette offered in the habit creator. */
export const HABIT_COLORS = [
  "#818cf8", // indigo
  "#34d399", // emerald
  "#fbbf24", // amber
  "#f87171", // red
  "#f472b6", // pink
  "#22d3ee", // cyan
  "#a78bfa", // violet
  "#fb923c", // orange
];

/** Composite key for a single habit-day completion record. */
export function logKey(habitId: string, key: string): string {
  return `${habitId}::${key}`;
}

/** Whether a habit is scheduled on a given date. */
export function isDue(habit: Habit, date: Date): boolean {
  const day = date.getDay(); // 0 = Sun … 6 = Sat
  switch (habit.frequency) {
    case "daily":
      return true;
    case "weekdays":
      return day >= 1 && day <= 5;
    case "custom":
      return (habit.customDays ?? []).includes(day);
  }
}

export function isCompleted(
  logs: HabitLogs,
  habitId: string,
  key: string,
): boolean {
  return logs[logKey(habitId, key)] === true;
}

/** Human label for a habit's frequency. */
export function frequencyLabel(habit: Habit): string {
  if (habit.frequency === "daily") return "Daily";
  if (habit.frequency === "weekdays") return "Weekdays";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (habit.customDays ?? [])
    .slice()
    .sort((a, b) => a - b)
    .map((d) => names[d])
    .join(", ") || "Custom";
}

/**
 * Current streak: consecutive scheduled days completed up to today. Today not
 * being done yet does not break the streak (you still have time).
 */
export function currentStreak(
  habit: Habit,
  logs: HabitLogs,
  asOf: Date = new Date(),
): number {
  let streak = 0;
  let cursor = startOfDay(asOf);
  for (let i = 0; i < 800; i++) {
    if (isDue(habit, cursor)) {
      if (isCompleted(logs, habit.id, dateKey(cursor))) {
        streak++;
      } else if (i !== 0) {
        break; // a missed past due-day ends the streak
      }
    }
    cursor = subDays(cursor, 1);
  }
  return streak;
}

/** Longest streak across the habit's entire history. */
export function longestStreak(habit: Habit, logs: HabitLogs): number {
  let longest = 0;
  let run = 0;
  let cursor = startOfDay(new Date(habit.createdAt));
  const today = startOfDay(new Date());
  for (let i = 0; i < 3000 && cursor <= today; i++) {
    if (isDue(habit, cursor)) {
      run = isCompleted(logs, habit.id, dateKey(cursor)) ? run + 1 : 0;
      if (run > longest) longest = run;
    }
    cursor = addDays(cursor, 1);
  }
  return longest;
}

export interface CompletionStats {
  done: number;
  due: number;
  rate: number; // 0–100
}

/** Completion stats for one habit over the last `days` days (ending today). */
export function completionStats(
  habit: Habit,
  logs: HabitLogs,
  days: number,
): CompletionStats {
  let done = 0;
  let due = 0;
  let cursor = startOfDay(new Date());
  const created = startOfDay(new Date(habit.createdAt));
  for (let i = 0; i < days; i++) {
    if (cursor >= created && isDue(habit, cursor)) {
      due++;
      if (isCompleted(logs, habit.id, dateKey(cursor))) done++;
    }
    cursor = subDays(cursor, 1);
  }
  return { done, due, rate: due === 0 ? 0 : Math.round((done / due) * 100) };
}

/** Aggregate consistency across all given habits over the last `days` days. */
export function aggregateConsistency(
  habits: Habit[],
  logs: HabitLogs,
  days: number,
): CompletionStats {
  let done = 0;
  let due = 0;
  for (const habit of habits) {
    const s = completionStats(habit, logs, days);
    done += s.done;
    due += s.due;
  }
  return { done, due, rate: due === 0 ? 0 : Math.round((done / due) * 100) };
}

// ── Mutations ──────────────────────────────────────────────────────────────

export interface HabitInput {
  name: string;
  category: HabitCategory;
  frequency: HabitFrequency;
  customDays?: number[];
  color: string;
  description?: string;
}

export function addHabit(input: HabitInput): Habit {
  const habit: Habit = {
    id: uid(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  updateSlice("habits", (habits) => [...habits, habit]);
  return habit;
}

export function updateHabit(habit: Habit): void {
  updateSlice("habits", (habits) =>
    habits.map((h) => (h.id === habit.id ? habit : h)),
  );
}

export function setHabitArchived(id: string, archived: boolean): void {
  updateSlice("habits", (habits) =>
    habits.map((h) => (h.id === id ? { ...h, archived } : h)),
  );
}

export function deleteHabit(id: string): void {
  updateSlice("habits", (habits) => habits.filter((h) => h.id !== id));
  // Drop this habit's completion records too.
  const prefix = `${id}::`;
  const logs = getDatabase().habitLogs;
  const next: HabitLogs = {};
  for (const key of Object.keys(logs)) {
    if (!key.startsWith(prefix)) next[key] = logs[key];
  }
  setSlice("habitLogs", next);
}

/** Toggle a single habit-day completion. */
export function toggleHabitLog(habitId: string, key: string): void {
  updateSlice("habitLogs", (logs) => {
    const k = logKey(habitId, key);
    const next = { ...logs };
    if (next[k]) delete next[k];
    else next[k] = true;
    return next;
  });
}
