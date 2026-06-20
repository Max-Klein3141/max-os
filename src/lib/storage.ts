import type { Database } from "../types";

/** localStorage key for each slice of the database. */
export const STORAGE_KEYS: Record<keyof Database, string> = {
  habits: "maxos_habits",
  habitLogs: "maxos_habit_logs",
  journal: "maxos_journal",
  goals: "maxos_goals",
  todos: "maxos_todos",
  knowledge: "maxos_knowledge",
  dailyLogs: "maxos_daily_logs",
  weeklyReviews: "maxos_weekly_reviews",
  quotes: "maxos_challenges",
  spacedRep: "maxos_spaced_rep",
};

/** Read and parse a value from localStorage, falling back if absent/corrupt. */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Persist a value to localStorage. Returns false (and warns) on quota errors. */
export function save<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`MAX OS: failed to save "${key}" — storage may be full.`, err);
    return false;
  }
}
