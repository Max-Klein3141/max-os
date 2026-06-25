import type { DailyLog } from "../types";
import { getDatabase, setSlice } from "./store";
import * as db from "./db";

/** Read a daily log, or an empty one for that date. */
export function getDailyLog(key: string): DailyLog {
  return getDatabase().dailyLogs[key] ?? { date: key };
}

/** Merge a patch into a daily log. */
export function updateDailyLog(key: string, patch: Partial<DailyLog>): void {
  const logs = getDatabase().dailyLogs;
  const next: DailyLog = {
    ...(logs[key] ?? { date: key }),
    ...patch,
    date: key,
  };
  setSlice("dailyLogs", { ...logs, [key]: next });
  
  // Sync to Supabase in the background
  db.saveDailyLog(key, next).catch(err => console.error("Failed to sync daily log to Supabase:", err));
}

/** Most recent non-empty wins, newest first. */
export function recentWins(
  logs: Record<string, DailyLog>,
  limit: number,
): { date: string; win: string }[] {
  return Object.values(logs)
    .filter((l) => l.win && l.win.trim())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((l) => ({ date: l.date, win: l.win as string }));
}
