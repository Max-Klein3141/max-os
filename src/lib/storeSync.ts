/**
 * Store sync layer — bridges in-memory store with Supabase persistence.
 * Intercepts store mutations and syncs to Supabase in the background.
 */

import * as db from './db';
import type { Habit, HabitLogs, DailyLog, JournalEntry, WeeklyReview, Goal } from '../types';

/** Sync a habits slice to Supabase. */
export async function syncHabits(habits: Habit[]): Promise<void> {
  try {
    for (const habit of habits) {
      await db.updateHabit(habit.id, habit);
    }
  } catch (err) {
    console.error('Failed to sync habits to Supabase:', err);
  }
}

/** Sync habit log entries to Supabase. */
export async function syncHabitLogs(logs: HabitLogs): Promise<void> {
  try {
    for (const [key, completed] of Object.entries(logs)) {
      const [habitId, date] = key.split('::');
      await db.toggleHabitLogEntry(habitId, date, completed);
    }
  } catch (err) {
    console.error('Failed to sync habit logs to Supabase:', err);
  }
}

/** Sync daily logs to Supabase. */
export async function syncDailyLogs(logs: Record<string, DailyLog>): Promise<void> {
  try {
    for (const [date, log] of Object.entries(logs)) {
      await db.saveDailyLog(date, log);
    }
  } catch (err) {
    console.error('Failed to sync daily logs to Supabase:', err);
  }
}

/** Sync journal entries to Supabase. */
export async function syncJournalEntries(entries: Record<string, JournalEntry>): Promise<void> {
  try {
    for (const [date, entry] of Object.entries(entries)) {
      await db.saveJournalEntry(date, entry);
    }
  } catch (err) {
    console.error('Failed to sync journal entries to Supabase:', err);
  }
}

/** Sync weekly reviews to Supabase. */
export async function syncWeeklyReviews(reviews: Record<string, WeeklyReview>): Promise<void> {
  try {
    for (const [weekKey, review] of Object.entries(reviews)) {
      await db.saveWeeklyReview(weekKey, review);
    }
  } catch (err) {
    console.error('Failed to sync weekly reviews to Supabase:', err);
  }
}

/** Sync goals to Supabase. */
export async function syncGoals(goals: Goal[]): Promise<void> {
  try {
    for (const goal of goals) {
      await db.updateGoal(goal.id, goal);
    }
  } catch (err) {
    console.error('Failed to sync goals to Supabase:', err);
  }
}
