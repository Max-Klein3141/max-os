import { useSyncExternalStore } from "react";
import type { Database } from "../types";
import { STORAGE_KEYS, load, save } from "./storage";

/** A fresh, empty database — used for defaults and on reset/import. */
export function emptyDatabase(): Database {
  return {
    habits: [],
    habitLogs: {},
    journal: {},
    goals: [],
    todos: [],
    knowledge: [],
    dailyLogs: {},
    weeklyReviews: {},
    quotes: [],
    spacedRep: [],
  };
}

function loadDatabase(): Database {
  const empty = emptyDatabase();
  return {
    habits: load(STORAGE_KEYS.habits, empty.habits),
    habitLogs: load(STORAGE_KEYS.habitLogs, empty.habitLogs),
    journal: load(STORAGE_KEYS.journal, empty.journal),
    goals: load(STORAGE_KEYS.goals, empty.goals),
    todos: load(STORAGE_KEYS.todos, empty.todos),
    knowledge: load(STORAGE_KEYS.knowledge, empty.knowledge),
    dailyLogs: load(STORAGE_KEYS.dailyLogs, empty.dailyLogs),
    weeklyReviews: load(STORAGE_KEYS.weeklyReviews, empty.weeklyReviews),
    quotes: load(STORAGE_KEYS.quotes, empty.quotes),
    spacedRep: load(STORAGE_KEYS.spacedRep, empty.spacedRep),
  };
}

/**
 * The single in-memory copy of the database. Reassigned (never mutated in place)
 * so that per-slice snapshots keep stable references between unrelated updates.
 */
let db: Database = loadDatabase();

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Read the whole database synchronously (e.g. for export). */
export function getDatabase(): Database {
  return db;
}

/** Replace one slice, persist it, and notify subscribers of that slice. */
export function setSlice<K extends keyof Database>(
  key: K,
  value: Database[K],
): void {
  db = { ...db, [key]: value };
  save(STORAGE_KEYS[key], value);
  emit();
}

/** Update one slice with a function of its current value. */
export function updateSlice<K extends keyof Database>(
  key: K,
  updater: (current: Database[K]) => Database[K],
): void {
  setSlice(key, updater(db[key]));
}

/** Subscribe a component to a single slice of the database. */
export function useSlice<K extends keyof Database>(key: K): Database[K] {
  return useSyncExternalStore(
    subscribe,
    () => db[key],
    () => db[key],
  );
}

/** Subscribe to the entire database (re-renders on any change). */
export function useDatabase(): Database {
  useSlice("habits");
  useSlice("habitLogs");
  useSlice("journal");
  useSlice("goals");
  useSlice("todos");
  useSlice("knowledge");
  useSlice("dailyLogs");
  useSlice("weeklyReviews");
  useSlice("quotes");
  useSlice("spacedRep");
  return db;
}

/** Replace the entire database (used by import / reset). */
export function replaceDatabase(next: Partial<Database>): void {
  db = { ...emptyDatabase(), ...next };
  for (const key of Object.keys(STORAGE_KEYS) as (keyof Database)[]) {
    save(STORAGE_KEYS[key], db[key]);
  }
  emit();
}

/** Generate a short, collision-resistant id. */
export function uid(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  );
}

// Keep tabs in sync: when another tab writes a known key, reload that slice.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key == null) {
      db = loadDatabase();
      emit();
      return;
    }
    const slice = (Object.keys(STORAGE_KEYS) as (keyof Database)[]).find(
      (k) => STORAGE_KEYS[k] === event.key,
    );
    if (slice) {
      const empty = emptyDatabase();
      db = { ...db, [slice]: load(STORAGE_KEYS[slice], empty[slice]) };
      emit();
    }
  });
}
