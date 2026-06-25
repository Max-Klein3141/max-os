/**
 * MAX OS — Supabase data service layer.
 *
 * All CRUD operations for communicating with Supabase, with automatic user_id
 * injection and Row Level Security compliance. Converts between in-memory shapes
 * and database schemas.
 */

import { supabase } from "./supabase";
import type {
  Habit,
  HabitLogs,
  HabitNotes,
  JournalEntry,
  Goal,
  Todo,
  KnowledgeEntry,
  DailyLog,
  WeeklyReview,
} from "../types";
import { STORAGE_KEYS, EXTRA_BACKUP_KEYS, load } from "./storage";
import type { Database } from "../types";

/** Get the current authenticated user or throw. */
async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Not authenticated");
  }
  return user;
}

// ──────────────────────────────────────────────────────────────────────────
// HABITS
// ──────────────────────────────────────────────────────────────────────────

export async function fetchHabits(): Promise<Habit[]> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("habits")
      .select("*")
      .eq("user_id", user.id);

    if (error) throw error;
    return (data || []).map(dbHabitToHabit);
  } catch (err) {
    console.error("Failed to fetch habits:", err);
    return [];
  }
}

export async function createHabit(habit: Omit<Habit, "id" | "createdAt">): Promise<Habit | null> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("habits")
      .insert([
        {
          user_id: user.id,
          name: habit.name,
          description: habit.description,
          frequency: habit.frequency,
          color: habit.color,
          category: habit.category,
          customDays: habit.customDays,
          identityStatement: habit.identityStatement,
          minimumViable: habit.minimumViable,
          goalId: habit.goalId,
          archived: habit.archived || false,
          createdAt: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data ? dbHabitToHabit(data) : null;
  } catch (err) {
    console.error("Failed to create habit:", err);
    return null;
  }
}

export async function updateHabit(id: string, updates: Partial<Habit>): Promise<Habit | null> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("habits")
      .update({
        name: updates.name,
        description: updates.description,
        frequency: updates.frequency,
        color: updates.color,
        category: updates.category,
        customDays: updates.customDays,
        identityStatement: updates.identityStatement,
        minimumViable: updates.minimumViable,
        goalId: updates.goalId,
        archived: updates.archived,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    return data ? dbHabitToHabit(data) : null;
  } catch (err) {
    console.error("Failed to update habit:", err);
    return null;
  }
}

export async function deleteHabit(id: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const { error } = await supabase
      .from("habits")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Failed to delete habit:", err);
    return false;
  }
}

function dbHabitToHabit(db: any): Habit {
  return {
    id: db.id,
    name: db.name,
    category: db.category,
    frequency: db.frequency,
    customDays: db.customDays,
    color: db.color,
    description: db.description,
    identityStatement: db.identityStatement,
    goalId: db.goalId,
    minimumViable: db.minimumViable,
    createdAt: db.createdAt,
    archived: db.archived,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// HABIT LOGS
// ──────────────────────────────────────────────────────────────────────────

export async function fetchHabitLogs(): Promise<HabitLogs> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", user.id);

    if (error) throw error;
    const result: HabitLogs = {};
    (data || []).forEach((log: any) => {
      const key = `${log.habit_id}::${log.date}`;
      result[key] = log.completed || false;
    });
    return result;
  } catch (err) {
    console.error("Failed to fetch habit logs:", err);
    return {};
  }
}

export async function toggleHabitLogEntry(
  habitId: string,
  date: string,
  completed: boolean,
  note?: string
): Promise<boolean> {
  try {
    const user = await getCurrentUser();

    // Try to update existing record
    const { data: existing, error: fetchError } = await supabase
      .from("habit_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("habit_id", habitId)
      .eq("date", date)
      .single();

    if (existing) {
      // Update
      const { error } = await supabase
        .from("habit_logs")
        .update({ completed, note: note || null })
        .eq("id", existing.id)
        .eq("user_id", user.id);
      if (error) throw error;
    } else {
      // Insert
      const { error } = await supabase.from("habit_logs").insert([
        {
          user_id: user.id,
          habit_id: habitId,
          date,
          completed,
          note: note || null,
          created_at: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.error("Failed to toggle habit log:", err);
    return false;
  }
}

export async function setHabitNote(habitId: string, date: string, note: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const { data: existing } = await supabase
      .from("habit_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("habit_id", habitId)
      .eq("date", date)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("habit_logs")
        .update({ note })
        .eq("id", existing.id)
        .eq("user_id", user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("habit_logs").insert([
        {
          user_id: user.id,
          habit_id: habitId,
          date,
          completed: false,
          note,
          created_at: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.error("Failed to set habit note:", err);
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// DAILY LOGS
// ──────────────────────────────────────────────────────────────────────────

export async function fetchDailyLogs(): Promise<Record<string, DailyLog>> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", user.id);

    if (error) throw error;
    const result: Record<string, DailyLog> = {};
    (data || []).forEach((log: any) => {
      result[log.date] = {
        date: log.date,
        energy: log.energy,
        sleep: log.sleep,
        stress: log.stress,
        win: log.wins,
        learning: log.learning,
        morningIntention: log.morning_intention,
      };
    });
    return result;
  } catch (err) {
    console.error("Failed to fetch daily logs:", err);
    return {};
  }
}

export async function saveDailyLog(date: string, log: Partial<DailyLog>): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const { data: existing } = await supabase
      .from("daily_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", date)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("daily_logs")
        .update({
          energy: log.energy,
          sleep: log.sleep,
          stress: log.stress,
          wins: log.win,
          learning: log.learning,
          morning_intention: log.morningIntention,
        })
        .eq("id", existing.id)
        .eq("user_id", user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("daily_logs").insert([
        {
          user_id: user.id,
          date,
          energy: log.energy,
          sleep: log.sleep,
          stress: log.stress,
          wins: log.win,
          learning: log.learning,
          morning_intention: log.morningIntention,
          created_at: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.error("Failed to save daily log:", err);
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// JOURNAL ENTRIES
// ──────────────────────────────────────────────────────────────────────────

export async function fetchJournalEntries(): Promise<Record<string, JournalEntry>> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", user.id);

    if (error) throw error;
    const result: Record<string, JournalEntry> = {};
    (data || []).forEach((entry: any) => {
      result[entry.date] = {
        date: entry.date,
        sections: entry.sections || {},
        content: entry.content,
        goalProgress: entry.goal_progress,
        tags: entry.tags || [],
        updatedAt: entry.updated_at,
      };
    });
    return result;
  } catch (err) {
    console.error("Failed to fetch journal entries:", err);
    return {};
  }
}

export async function saveJournalEntry(date: string, entry: JournalEntry): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const { data: existing } = await supabase
      .from("journal_entries")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", date)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("journal_entries")
        .update({
          sections: entry.sections,
          content: entry.content,
          goal_progress: entry.goalProgress,
          tags: entry.tags,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("user_id", user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("journal_entries").insert([
        {
          user_id: user.id,
          date,
          sections: entry.sections,
          content: entry.content,
          goal_progress: entry.goalProgress,
          tags: entry.tags,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.error("Failed to save journal entry:", err);
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// WEEKLY REVIEWS
// ──────────────────────────────────────────────────────────────────────────

export async function fetchWeeklyReviews(): Promise<Record<string, WeeklyReview>> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("weekly_reviews")
      .select("*")
      .eq("user_id", user.id);

    if (error) throw error;
    const result: Record<string, WeeklyReview> = {};
    (data || []).forEach((review: any) => {
      const weekKey = review.week_start; // Format should be RRRR-'W'II
      result[weekKey] = {
        week: weekKey,
        wins: review.highlights,
        mistakes: review.challenges,
        lessons: review.lessons,
        goalsProgress: review.goal_progress,
        focusNext: review.next_week_focus,
        word: review.word,
        createdAt: review.created_at,
        updatedAt: review.updated_at,
      };
    });
    return result;
  } catch (err) {
    console.error("Failed to fetch weekly reviews:", err);
    return {};
  }
}

export async function saveWeeklyReview(weekKey: string, review: WeeklyReview): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const { data: existing } = await supabase
      .from("weekly_reviews")
      .select("id")
      .eq("user_id", user.id)
      .eq("week_start", weekKey)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("weekly_reviews")
        .update({
          highlights: review.wins,
          challenges: review.mistakes,
          lessons: review.lessons,
          goal_progress: review.goalsProgress,
          next_week_focus: review.focusNext,
          word: review.word,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("user_id", user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("weekly_reviews").insert([
        {
          user_id: user.id,
          week_start: weekKey,
          highlights: review.wins,
          challenges: review.mistakes,
          lessons: review.lessons,
          goal_progress: review.goalsProgress,
          next_week_focus: review.focusNext,
          word: review.word,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.error("Failed to save weekly review:", err);
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// GOALS
// ──────────────────────────────────────────────────────────────────────────

export async function fetchGoals(): Promise<Goal[]> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id);

    if (error) throw error;
    return (data || []).map((g: any) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      horizon: g.horizon,
      progress: g.progress,
      image: g.image,
      milestones: g.milestones,
      targetDate: g.target_date,
      createdAt: g.created_at,
    }));
  } catch (err) {
    console.error("Failed to fetch goals:", err);
    return [];
  }
}

export async function createGoal(goal: Omit<Goal, "id" | "createdAt">): Promise<Goal | null> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("goals")
      .insert([
        {
          user_id: user.id,
          title: goal.title,
          description: goal.description,
          horizon: goal.horizon,
          progress: goal.progress,
          image: goal.image,
          milestones: goal.milestones,
          target_date: goal.targetDate,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data
      ? {
          id: data.id,
          title: data.title,
          description: data.description,
          horizon: data.horizon,
          progress: data.progress,
          image: data.image,
          milestones: data.milestones,
          targetDate: data.target_date,
          createdAt: data.created_at,
        }
      : null;
  } catch (err) {
    console.error("Failed to create goal:", err);
    return null;
  }
}

export async function updateGoal(id: string, updates: Partial<Goal>): Promise<Goal | null> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("goals")
      .update({
        title: updates.title,
        description: updates.description,
        horizon: updates.horizon,
        progress: updates.progress,
        image: updates.image,
        milestones: updates.milestones,
        target_date: updates.targetDate,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    return data
      ? {
          id: data.id,
          title: data.title,
          description: data.description,
          horizon: data.horizon,
          progress: data.progress,
          image: data.image,
          milestones: data.milestones,
          targetDate: data.target_date,
          createdAt: data.created_at,
        }
      : null;
  } catch (err) {
    console.error("Failed to update goal:", err);
    return null;
  }
}

export async function deleteGoal(id: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const { error } = await supabase
      .from("goals")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Failed to delete goal:", err);
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// SETTINGS & PREFERENCES
// ──────────────────────────────────────────────────────────────────────────

export async function fetchSettings(): Promise<{ identity: string; bannerDismissals: Record<string, boolean> }> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("settings")
      .select("preferences")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows returned
    
    const preferences = data?.preferences || {};
    return {
      identity: preferences.identity || "",
      bannerDismissals: preferences.bannerDismissals || {},
    };
  } catch (err) {
    console.error("Failed to fetch settings:", err);
    return { identity: "", bannerDismissals: {} };
  }
}

export async function saveSettings(preferences: { identity?: string; bannerDismissals?: Record<string, boolean> }): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const { error } = await supabase.from("settings").upsert(
      [
        {
          user_id: user.id,
          preferences,
          created_at: new Date().toISOString(),
        },
      ],
      { onConflict: "user_id" }
    );
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Failed to save settings:", err);
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// MIGRATION
// ──────────────────────────────────────────────────────────────────────────

/**
 * One-time migration helper: uploads all localStorage data to Supabase under
 * the current user's account, then clears localStorage (except maxos_view).
 */
export async function migrateFromLocalStorage(): Promise<boolean> {
  try {
    const user = await getCurrentUser();

    // Check if there's data to migrate
    const hasData = Object.values(STORAGE_KEYS).some((key) => localStorage.getItem(key));
    if (!hasData) {
      console.log("No localStorage data to migrate");
      return true;
    }

    console.log("Starting localStorage migration to Supabase...");

    // Load all data from localStorage
    const habits = load<Habit[]>(STORAGE_KEYS.habits, []);
    const habitLogs = load<HabitLogs>(STORAGE_KEYS.habitLogs, {});
    const habitNotes = load<HabitNotes>(STORAGE_KEYS.habitNotes, {});
    const dailyLogs = load<Record<string, DailyLog>>(STORAGE_KEYS.dailyLogs, {});
    const journal = load<Record<string, JournalEntry>>(STORAGE_KEYS.journal, {});
    const weeklyReviews = load<Record<string, WeeklyReview>>(
      STORAGE_KEYS.weeklyReviews,
      {}
    );
    const goals = load<Goal[]>(STORAGE_KEYS.goals, []);
    const todos = load<Todo[]>(STORAGE_KEYS.todos, []);
    const knowledge = load<KnowledgeEntry[]>(STORAGE_KEYS.knowledge, []);
    const identity = localStorage.getItem("maxos_identity") || "";
    const bannerDismissals = localStorage.getItem("maxos_banner_dismissals") || "{}";

    // Migrate habits
    for (const habit of habits) {
      await supabase.from("habits").upsert(
        [
          {
            id: habit.id,
            user_id: user.id,
            name: habit.name,
            description: habit.description,
            frequency: habit.frequency,
            color: habit.color,
            category: habit.category,
            customDays: habit.customDays,
            identityStatement: habit.identityStatement,
            minimumViable: habit.minimumViable,
            goalId: habit.goalId,
            archived: habit.archived,
            createdAt: habit.createdAt,
          },
        ],
        { onConflict: "id" }
      );
    }

    // Migrate habit logs
    for (const [key, completed] of Object.entries(habitLogs)) {
      const [habitId, date] = key.split("::");
      const note = habitNotes[key] || null;
      await supabase.from("habit_logs").upsert(
        [
          {
            user_id: user.id,
            habit_id: habitId,
            date,
            completed,
            note,
            created_at: new Date().toISOString(),
          },
        ],
        { onConflict: "user_id,habit_id,date" }
      );
    }

    // Migrate daily logs
    for (const [date, log] of Object.entries(dailyLogs)) {
      await supabase.from("daily_logs").upsert(
        [
          {
            user_id: user.id,
            date,
            energy: log.energy,
            sleep: log.sleep,
            stress: log.stress,
            wins: log.win,
            learning: log.learning,
            morning_intention: log.morningIntention,
            created_at: new Date().toISOString(),
          },
        ],
        { onConflict: "user_id,date" }
      );
    }

    // Migrate journal entries
    for (const [date, entry] of Object.entries(journal)) {
      await supabase.from("journal_entries").upsert(
        [
          {
            user_id: user.id,
            date,
            sections: entry.sections,
            content: entry.content,
            goal_progress: entry.goalProgress,
            tags: entry.tags,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        ],
        { onConflict: "user_id,date" }
      );
    }

    // Migrate weekly reviews
    for (const [weekKey, review] of Object.entries(weeklyReviews)) {
      await supabase.from("weekly_reviews").upsert(
        [
          {
            user_id: user.id,
            week_start: weekKey,
            highlights: review.wins,
            challenges: review.mistakes,
            lessons: review.lessons,
            goal_progress: review.goalsProgress,
            next_week_focus: review.focusNext,
            word: review.word,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "user_id,week_start" }
      );
    }

    // Migrate goals
    for (const goal of goals) {
      await supabase.from("goals").upsert(
        [
          {
            id: goal.id,
            user_id: user.id,
            title: goal.title,
            description: goal.description,
            horizon: goal.horizon,
            progress: goal.progress,
            image: goal.image,
            milestones: goal.milestones,
            target_date: goal.targetDate,
            created_at: goal.createdAt,
          },
        ],
        { onConflict: "id" }
      );
    }

    // Store identity and banner dismissals in settings (or as user metadata)
    const preferences = {
      identity,
      bannerDismissals: JSON.parse(bannerDismissals),
    };
    await supabase.from("settings").upsert(
      [
        {
          user_id: user.id,
          preferences,
          created_at: new Date().toISOString(),
        },
      ],
      { onConflict: "user_id" }
    );

    // Clear localStorage except maxos_view
    for (const key of Object.values(STORAGE_KEYS)) {
      localStorage.removeItem(key);
    }
    for (const key of EXTRA_BACKUP_KEYS) {
      localStorage.removeItem(key);
    }

    console.log("Migration complete!");
    return true;
  } catch (err) {
    console.error("Failed to migrate localStorage to Supabase:", err);
    return false;
  }
}
