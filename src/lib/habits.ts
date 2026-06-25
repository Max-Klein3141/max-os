import { addDays, startOfDay, subDays } from "date-fns";
import type {
  Habit,
  HabitCategory,
  HabitFrequency,
  HabitLogs,
  HabitNotes,
} from "../types";
import { setSlice, uid, updateSlice, getDatabase } from "./store";
import { dateKey } from "./dates";
import * as db from "./db";

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

/**
 * Length of the most recent completed run that has since been broken — i.e. the
 * streak you *used* to have before the current gap. Returns 0 if there's no
 * broken run (e.g. the streak is still alive, or you never had one). Used to
 * prompt a restart after a lapse.
 */
export function previousStreak(
  habit: Habit,
  logs: HabitLogs,
  asOf: Date = new Date(),
): number {
  // Start from yesterday — today not being done yet isn't a "break".
  let cursor = subDays(startOfDay(asOf), 1);
  let guard = 0;
  // Walk back over the gap (missed scheduled days) to the end of the last run.
  for (; guard < 800; guard++) {
    if (isDue(habit, cursor)) {
      if (isCompleted(logs, habit.id, dateKey(cursor))) break;
    }
    cursor = subDays(cursor, 1);
  }
  // Count the consecutive completed scheduled days that make up that run.
  let streak = 0;
  for (; guard < 1600; guard++) {
    if (isDue(habit, cursor)) {
      if (isCompleted(logs, habit.id, dateKey(cursor))) streak++;
      else break;
    }
    cursor = subDays(cursor, 1);
  }
  return streak;
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

/** How many days back the momentum scale looks — two weeks, matching the grid. */
export const MOMENTUM_WINDOW_DAYS = 14;

/**
 * Recency half-life (days) for the momentum scale: a scheduled day this many
 * days ago counts half as much toward momentum as today.
 */
export const MOMENTUM_HALF_LIFE = 14;

export interface WeightedConsistency extends CompletionStats {
  /** 0–100 — completion percentage with recent days weighted more heavily. */
  weighted: number;
}

/**
 * Momentum scale: the share of scheduled habit-days completed over the last
 * `windowDays` days, weighting recent days more than older ones. Each scheduled
 * day at age `n` (today = 0) is weighted `2^(-n / halfLife)`. Days before the
 * habit was created don't count (they were never "missed"), so the score
 * reaches 100% only when *all* boxes that actually existed in the window are
 * checked. `rate` keeps the plain (unweighted) percentage for context.
 */
export function weightedConsistency(
  habits: Habit[],
  logs: HabitLogs,
  asOf: Date = new Date(),
  windowDays: number = MOMENTUM_WINDOW_DAYS,
  halfLife: number = MOMENTUM_HALF_LIFE,
): WeightedConsistency {
  const today = startOfDay(asOf);
  const decay = Math.LN2 / halfLife;
  let weightedDone = 0;
  let weightedDue = 0;
  let done = 0;
  let due = 0;
  for (const habit of habits) {
    const created = startOfDay(new Date(habit.createdAt));
    let cursor = today;
    for (let age = 0; age < windowDays; age++) {
      // Days before the habit existed aren't "missed" — skip them entirely.
      if (cursor >= created && isDue(habit, cursor)) {
        const w = Math.exp(-decay * age);
        weightedDue += w;
        due++;
        if (isCompleted(logs, habit.id, dateKey(cursor))) {
          weightedDone += w;
          done++;
        }
      }
      cursor = subDays(cursor, 1);
    }
  }
  return {
    done,
    due,
    rate: due === 0 ? 0 : Math.round((done / due) * 100),
    weighted: weightedDue === 0 ? 0 : Math.round((weightedDone / weightedDue) * 100),
  };
}

// ── Mutations ──────────────────────────────────────────────────────────────

export interface HabitInput {
  name: string;
  category: HabitCategory;
  frequency: HabitFrequency;
  customDays?: number[];
  color: string;
  description?: string;
  identityStatement?: string;
  goalId?: string;
  minimumViable?: string;
}

export function addHabit(input: HabitInput): Habit {
  const habit: Habit = {
    id: uid(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  updateSlice("habits", (habits) => [...habits, habit]);
  // Sync to Supabase in the background
  db.createHabit({
    ...habit,
  }).catch(err => console.error("Failed to sync habit to Supabase:", err));
  return habit;
}

export function updateHabit(habit: Habit): void {
  updateSlice("habits", (habits) =>
    habits.map((h) => (h.id === habit.id ? habit : h)),
  );
  // Sync to Supabase in the background
  db.updateHabit(habit.id, habit).catch(err => console.error("Failed to sync habit update to Supabase:", err));
}

export function setHabitArchived(id: string, archived: boolean): void {
  updateSlice("habits", (habits) =>
    habits.map((h) => (h.id === id ? { ...h, archived } : h)),
  );
  // Sync to Supabase in the background
  db.updateHabit(id, { archived } as any).catch(err => console.error("Failed to sync habit archive to Supabase:", err));
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
  
  // Sync to Supabase in the background
  db.deleteHabit(id).catch(err => console.error("Failed to sync habit deletion to Supabase:", err));
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
  
  // Sync to Supabase in the background
  const logs = getDatabase().habitLogs;
  const k = logKey(habitId, key);
  const completed = logs[k] === true;
  db.toggleHabitLogEntry(habitId, key, completed).catch(err => console.error("Failed to sync habit log to Supabase:", err));
}

/** Read a per-habit, per-day note (e.g. a streak-recovery commitment). */
export function habitNote(
  notes: HabitNotes,
  habitId: string,
  key: string,
): string | undefined {
  return notes[logKey(habitId, key)];
}

/** Whether a note (even empty) has been recorded for this habit-day. */
export function hasHabitNote(
  notes: HabitNotes,
  habitId: string,
  key: string,
): boolean {
  return logKey(habitId, key) in notes;
}

/** Save a per-habit, per-day note. Storing it also dismisses the recovery prompt. */
export function setHabitNote(habitId: string, key: string, text: string): void {
  updateSlice("habitNotes", (notes) => ({
    ...notes,
    [logKey(habitId, key)]: text.trim(),
  }));
  
  // Sync to Supabase in the background
  db.setHabitNote(habitId, key, text.trim()).catch(err => console.error("Failed to sync habit note to Supabase:", err));
}
