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

export async function createHabit(habit: Habit): Promise<Habit | null> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("habits")
      .insert([
        {
          // Use the locally-generated id so it matches habit_logs and the rest
          // of the local-first store (the id column has no DB-side default).
          id: habit.id,
          user_id: user.id,
          name: habit.name,
          description: habit.description,
          frequency: habit.frequency,
          color: habit.color,
          category: habit.category,
          custom_days: habit.customDays,
          identity_statement: habit.identityStatement,
          minimum_viable: habit.minimumViable,
          goal_id: habit.goalId,
          archived: habit.archived || false,
          created_at: habit.createdAt,
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
        custom_days: updates.customDays,
        identity_statement: updates.identityStatement,
        minimum_viable: updates.minimumViable,
        goal_id: updates.goalId,
        archived: updates.archived ?? false,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();

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
    customDays: db.custom_days,
    color: db.color,
    description: db.description,
    identityStatement: db.identity_statement,
    goalId: db.goal_id,
    minimumViable: db.minimum_viable,
    createdAt: db.created_at,
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
    const { data: existing } = await supabase
      .from("habit_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("habit_id", habitId)
      .eq("date", date)
      .maybeSingle();

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
      .maybeSingle();

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
      .maybeSingle();

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
      .maybeSingle();

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
      .maybeSingle();

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

export async function createGoal(goal: Goal): Promise<Goal | null> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("goals")
      .insert([
        {
          // Match the locally-generated id (no DB-side default on the id column).
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
      .maybeSingle();

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

/** Insert-or-update a goal by id (robust to whether it already exists). */
export async function saveGoal(goal: Goal): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const { error } = await supabase.from("goals").upsert(
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
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Failed to save goal:", err);
    return false;
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
// TODOS
// ──────────────────────────────────────────────────────────────────────────

export async function fetchTodos(): Promise<Todo[]> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("todos")
      .select("*")
      .eq("user_id", user.id);

    if (error) throw error;
    return (data || []).map((t: any) => ({
      id: t.id,
      text: t.text,
      done: t.done,
      priority: t.priority,
      date: t.date,
      order: t.sort_order,
      startMin: t.start_min ?? undefined,
      durationMin: t.duration_min ?? undefined,
      goalId: t.goal_id ?? undefined,
      createdAt: t.created_at,
    }));
  } catch (err) {
    console.error("Failed to fetch todos:", err);
    return [];
  }
}

export async function saveTodo(todo: Todo): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const { error } = await supabase.from("todos").upsert(
      [
        {
          id: todo.id,
          user_id: user.id,
          text: todo.text,
          done: todo.done,
          priority: todo.priority,
          date: todo.date,
          sort_order: todo.order,
          start_min: todo.startMin,
          duration_min: todo.durationMin,
          goal_id: todo.goalId,
          created_at: todo.createdAt,
        },
      ],
      { onConflict: "id" }
    );
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Failed to save todo:", err);
    return false;
  }
}

export async function deleteTodo(id: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const { error } = await supabase
      .from("todos")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Failed to delete todo:", err);
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// KNOWLEDGE
// ──────────────────────────────────────────────────────────────────────────

export async function fetchKnowledge(): Promise<KnowledgeEntry[]> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from("knowledge")
      .select("*")
      .eq("user_id", user.id);

    if (error) throw error;
    return (data || []).map((k: any) => ({
      id: k.id,
      title: k.title,
      body: k.body,
      tags: k.tags || [],
      source: k.source ?? undefined,
      sourceType: k.source_type,
      createdAt: k.created_at,
    }));
  } catch (err) {
    console.error("Failed to fetch knowledge:", err);
    return [];
  }
}

export async function saveKnowledge(entry: KnowledgeEntry): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const { error } = await supabase.from("knowledge").upsert(
      [
        {
          id: entry.id,
          user_id: user.id,
          title: entry.title,
          body: entry.body,
          tags: entry.tags,
          source: entry.source,
          source_type: entry.sourceType,
          created_at: entry.createdAt,
        },
      ],
      { onConflict: "id" }
    );
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Failed to save knowledge:", err);
    return false;
  }
}

export async function deleteKnowledge(id: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const { error } = await supabase
      .from("knowledge")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Failed to delete knowledge:", err);
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
      .maybeSingle();

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

    // Track whether every upload succeeds. We only delete localStorage if the
    // whole migration succeeded, so a partial/failed run can never lose data —
    // it simply retries on the next load.
    let migrationOk = true;
    const tryUpsert = async (
      table: string,
      rows: Record<string, unknown>[],
      opts: { onConflict: string },
    ) => {
      const { error } = await supabase.from(table).upsert(rows, opts);
      if (error) {
        migrationOk = false;
        console.error(`Migration: failed to upsert into "${table}":`, error.message);
      }
    };

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
      await tryUpsert("habits",
        [
          {
            id: habit.id,
            user_id: user.id,
            name: habit.name,
            description: habit.description,
            frequency: habit.frequency,
            color: habit.color,
            category: habit.category,
            custom_days: habit.customDays,
            identity_statement: habit.identityStatement,
            minimum_viable: habit.minimumViable,
            goal_id: habit.goalId,
            archived: habit.archived ?? false,
            created_at: habit.createdAt,
          },
        ],
        { onConflict: "id" }
      );
    }

    // Migrate habit logs
    for (const [key, completed] of Object.entries(habitLogs)) {
      const [habitId, date] = key.split("::");
      const note = habitNotes[key] || null;
      await tryUpsert("habit_logs",
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
      await tryUpsert("daily_logs",
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
      await tryUpsert("journal_entries",
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
      await tryUpsert("weekly_reviews",
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
      await tryUpsert("goals",
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

    // Migrate todos
    for (const todo of todos) {
      await tryUpsert("todos",
        [
          {
            id: todo.id,
            user_id: user.id,
            text: todo.text,
            done: todo.done,
            priority: todo.priority,
            date: todo.date,
            sort_order: todo.order,
            start_min: todo.startMin,
            duration_min: todo.durationMin,
            goal_id: todo.goalId,
            created_at: todo.createdAt,
          },
        ],
        { onConflict: "id" }
      );
    }

    // Migrate knowledge entries
    for (const entry of knowledge) {
      await tryUpsert("knowledge",
        [
          {
            id: entry.id,
            user_id: user.id,
            title: entry.title,
            body: entry.body,
            tags: entry.tags,
            source: entry.source,
            source_type: entry.sourceType,
            created_at: entry.createdAt,
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
    await tryUpsert("settings",
      [
        {
          user_id: user.id,
          preferences,
          created_at: new Date().toISOString(),
        },
      ],
      { onConflict: "user_id" }
    );

    // Only delete localStorage if EVERY upload succeeded. Otherwise keep it as
    // the source of truth (nothing is lost) and let the migration retry next load.
    if (migrationOk) {
      for (const key of Object.values(STORAGE_KEYS)) {
        localStorage.removeItem(key);
      }
      for (const key of EXTRA_BACKUP_KEYS) {
        localStorage.removeItem(key);
      }
      console.log("Migration complete!");
    } else {
      console.warn(
        "Migration finished with errors — your local data was kept (nothing deleted). " +
          "Fix the Supabase schema, then reload to retry.",
      );
    }
    return migrationOk;
  } catch (err) {
    console.error("Failed to migrate localStorage to Supabase:", err);
    return false;
  }
}
