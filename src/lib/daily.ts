import type { DailyLog } from "../types";
import { getDatabase, setSlice } from "./store";
import { scheduleForLearning } from "./spacedRep";

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
}

/** Save a learning summary and (re)schedule its spaced-repetition reviews. */
export function saveLearning(key: string, learning: string): void {
  updateDailyLog(key, { learning });
  scheduleForLearning(key, learning);
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
