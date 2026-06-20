/**
 * MAX OS — core data types.
 *
 * Everything is persisted to localStorage. Dates used as keys are formatted
 * `yyyy-MM-dd` ("date keys"); ISO weeks are formatted `RRRR-'W'II` (e.g. 2026-W25).
 */

export type HabitCategory =
  | "health"
  | "mind"
  | "work"
  | "relationships"
  | "custom";

export type HabitFrequency = "daily" | "weekdays" | "custom";

export interface Habit {
  id: string;
  name: string;
  category: HabitCategory;
  frequency: HabitFrequency;
  /** Day indices 0–6 (Sun–Sat), used when frequency === "custom". */
  customDays?: number[];
  /** Accent color for the habit (hex). */
  color: string;
  description?: string;
  createdAt: string; // ISO timestamp
  archived?: boolean;
}

/**
 * Habit completion records. Keyed by `${habitId}::${dateKey}`; presence with a
 * truthy value means "completed that day".
 */
export type HabitLogs = Record<string, boolean>;

export interface JournalEntry {
  /** yyyy-MM-dd — also the storage key for the entry. */
  date: string;
  content: string;
  tags: string[];
  updatedAt: string; // ISO timestamp
}

export type GoalHorizon = "short" | "mid" | "long";

export interface Milestone {
  id: string;
  text: string;
  done: boolean;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  horizon: GoalHorizon;
  /** 0–100, manually updated. */
  progress: number;
  /** Motivational image stored as a base64 data URL. */
  image?: string;
  milestones: Milestone[];
  /** yyyy-MM-dd target date. */
  targetDate?: string;
  createdAt: string;
}

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  priority: boolean;
  /** yyyy-MM-dd the task currently belongs to. Uncompleted tasks roll forward. */
  date: string;
  /** Sort order within the day. */
  order: number;
  createdAt: string;
}

export type KnowledgeSourceType =
  | "book"
  | "article"
  | "conversation"
  | "experience"
  | "idea"
  | "other";

export interface KnowledgeEntry {
  id: string;
  title: string;
  body: string;
  tags: string[];
  /** Free-text source, e.g. "Zero to One". */
  source?: string;
  sourceType: KnowledgeSourceType;
  createdAt: string;
}

export interface DailyLog {
  /** yyyy-MM-dd — also the storage key. */
  date: string;
  energy?: number; // 1–5
  sleep?: number; // 1–5
  stress?: number; // 1–5
  win?: string;
  learning?: string;
}

export interface WeeklyReview {
  /** ISO week key, e.g. "2026-W25" — also the storage key. */
  week: string;
  wins: string;
  mistakes: string;
  lessons: string;
  goalsProgress: string;
  focusNext: string;
  /** A single word describing the week. */
  word: string;
  createdAt: string;
  updatedAt: string;
}

export interface Quote {
  id: string;
  text: string;
  author?: string;
}

export type SpacedRepStatus = "pending" | "done";

export interface SpacedRepCard {
  id: string;
  /** Date of the original learning entry (yyyy-MM-dd). */
  sourceDate: string;
  /** The learning text to recall. */
  learning: string;
  /** yyyy-MM-dd the card becomes due. */
  dueDate: string;
  /** Which review step this card represents (days after the source). */
  interval: number;
  status: SpacedRepStatus;
  createdAt: string;
}

/** The full shape of everything MAX OS keeps in memory / localStorage. */
export interface Database {
  habits: Habit[];
  habitLogs: HabitLogs;
  journal: Record<string, JournalEntry>;
  goals: Goal[];
  todos: Todo[];
  knowledge: KnowledgeEntry[];
  dailyLogs: Record<string, DailyLog>;
  weeklyReviews: Record<string, WeeklyReview>;
  quotes: Quote[];
  spacedRep: SpacedRepCard[];
}
