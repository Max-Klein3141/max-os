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
  /** Optional identity anchor, e.g. "I am someone who trains every day". */
  identityStatement?: string;
  /** Optional id of a Goal this habit serves. */
  goalId?: string;
  /** The minimum version of this habit to do on a hard day (keeps the chain). */
  minimumViable?: string;
  createdAt: string; // ISO timestamp
  archived?: boolean;
}

/**
 * Per-habit, per-day free-text notes, keyed `${habitId}::${dateKey}`. Currently
 * holds streak-recovery commitments ("what will you do differently?").
 */
export type HabitNotes = Record<string, string>;

/**
 * Habit completion records. Keyed by `${habitId}::${dateKey}`; presence with a
 * truthy value means "completed that day".
 */
export type HabitLogs = Record<string, boolean>;

export interface JournalEntry {
  /** yyyy-MM-dd — also the storage key for the entry. */
  date: string;
  /** Structured prompt responses, keyed by prompt id (see JOURNAL_PROMPTS). */
  sections: Record<string, string>;
  /** Legacy freeform body from older entries; migrated into `sections` on edit. */
  content?: string;
  /** Free-text weekly progress notes per goal, keyed by goal id. */
  goalProgress?: Record<string, string>;
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
  /** Sort order within the day (among unscheduled tasks). */
  order: number;
  /**
   * Time-box start, in minutes from local midnight (e.g. 540 = 09:00). When set
   * (together with `durationMin`), the task is scheduled into the day timeline
   * rather than the loose to-do list.
   */
  startMin?: number;
  /** Time-box length in minutes. Only meaningful when `startMin` is set. */
  durationMin?: number;
  /** Optional id of a Goal this task moves toward. */
  goalId?: string;
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
  /** The one thing that would make today a win, set in the morning. */
  morningIntention?: string;
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

/**
 * A single thing learned, framed as a question + answer so it can be actively
 * recalled. Each item seeds a series of spaced-repetition cards.
 */
export interface LearningItem {
  id: string;
  /** The recall prompt the user writes, e.g. "Why does X cause Y?". */
  question: string;
  /** The answer to reveal and check against. */
  answer: string;
  /** yyyy-MM-dd it was learned. */
  sourceDate: string;
  createdAt: string;
}

export interface SpacedRepCard {
  id: string;
  /** The LearningItem this card reviews. Absent on legacy day-based cards. */
  itemId?: string;
  /** Date of the original learning entry (yyyy-MM-dd). */
  sourceDate: string;
  /** Recall prompt for Q&A cards. Legacy freeform cards have none. */
  question?: string;
  /** The answer / learning text to recall. */
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
  habitNotes: HabitNotes;
  journal: Record<string, JournalEntry>;
  goals: Goal[];
  todos: Todo[];
  knowledge: KnowledgeEntry[];
  dailyLogs: Record<string, DailyLog>;
  weeklyReviews: Record<string, WeeklyReview>;
  quotes: Quote[];
  spacedRep: SpacedRepCard[];
  learningItems: LearningItem[];
}
