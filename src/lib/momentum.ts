import type { Database } from "../types";
import { dateKey } from "./dates";
import { currentStreak, isCompleted, isDue } from "./habits";

export interface MomentumBreakdown {
  score: number; // 0–100
  habits: number; // contribution, max 50
  streak: number; // contribution, max 20
  energy: number; // contribution, max 20
  win: number; // contribution, max 10
  dueToday: number;
  doneToday: number;
}

/**
 * Momentum score for a given day, from habit completion (50), best current
 * streak (20), energy (20), and whether a win was logged (10).
 */
export function computeMomentum(
  db: Database,
  date: Date = new Date(),
): MomentumBreakdown {
  const key = dateKey(date);
  const active = db.habits.filter((h) => !h.archived);

  let dueToday = 0;
  let doneToday = 0;
  for (const h of active) {
    if (isDue(h, date)) {
      dueToday++;
      if (isCompleted(db.habitLogs, h.id, key)) doneToday++;
    }
  }

  // Nothing scheduled → neutral half-credit rather than a zero.
  const habits = dueToday > 0 ? (doneToday / dueToday) * 50 : 25;

  let best = 0;
  for (const h of active) {
    const s = currentStreak(h, db.habitLogs, date);
    if (s > best) best = s;
  }
  const streak = Math.min(best / 21, 1) * 20;

  const log = db.dailyLogs[key];
  const energy = log?.energy ? (log.energy / 5) * 20 : 0;
  const win = log?.win && log.win.trim() ? 10 : 0;

  const score = Math.round(
    Math.max(0, Math.min(100, habits + streak + energy + win)),
  );

  return {
    score,
    habits: Math.round(habits),
    streak: Math.round(streak),
    energy: Math.round(energy),
    win,
    dueToday,
    doneToday,
  };
}
