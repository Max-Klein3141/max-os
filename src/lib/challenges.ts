import { differenceInCalendarDays } from "date-fns";
import type { Database, KnowledgeEntry, Quote } from "../types";
import { dateKey } from "./dates";
import { uid, updateSlice } from "./store";

/** Built-in quote pool. User-added quotes (stored) are merged with these. */
export const DEFAULT_QUOTES: Quote[] = [
  { id: "dq1", text: "We suffer more often in imagination than in reality.", author: "Seneca" },
  { id: "dq2", text: "Discipline equals freedom.", author: "Jocko Willink" },
  { id: "dq3", text: "What gets measured gets managed.", author: "Peter Drucker" },
  { id: "dq4", text: "The obstacle is the way.", author: "Marcus Aurelius" },
  { id: "dq5", text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
  { id: "dq6", text: "Hard choices, easy life. Easy choices, hard life.", author: "Jerzy Gregorek" },
  { id: "dq7", text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
  { id: "dq8", text: "The man who moves a mountain begins by carrying away small stones.", author: "Confucius" },
];

/** Reflection prompts surfaced as the daily challenge. */
export const REFLECTION_PROMPTS: string[] = [
  "What decision did you make this week that you're proud of?",
  "What's one thing you're avoiding, and why?",
  "Who did you help recently, and how?",
  "What would make today a win, even if nothing else goes right?",
  "What did you believe a year ago that you no longer believe?",
  "Where did you spend energy that didn't matter?",
  "What's the smallest next step on your biggest goal?",
  "What are you grateful for right now that you usually overlook?",
];

export type DailyChallenge =
  | { kind: "quote"; quote: Quote }
  | { kind: "reflection"; prompt: string }
  | { kind: "knowledge"; entry: KnowledgeEntry };

/** Deterministic 32-bit hash of a string (FNV-1a). */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Pick today's challenge, seeded by the date so it stays stable across reloads.
 * Rotates through quote recall, reflection prompts, and (when available) a
 * knowledge-base entry from 30+ days ago.
 */
export function getDailyChallenge(
  db: Database,
  date: Date = new Date(),
): DailyChallenge {
  const seed = hashStr(dateKey(date));
  const quotes = [...DEFAULT_QUOTES, ...db.quotes];
  const oldKnowledge = db.knowledge.filter(
    (e) => differenceInCalendarDays(date, new Date(e.createdAt)) >= 30,
  );

  const kinds: DailyChallenge["kind"][] = ["quote", "reflection"];
  if (oldKnowledge.length) kinds.push("knowledge");
  const kind = kinds[seed % kinds.length];

  if (kind === "reflection") {
    return { kind, prompt: REFLECTION_PROMPTS[seed % REFLECTION_PROMPTS.length] };
  }
  if (kind === "knowledge") {
    return { kind, entry: oldKnowledge[seed % oldKnowledge.length] };
  }
  return { kind: "quote", quote: quotes[seed % quotes.length] };
}

export function addQuote(text: string, author?: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  updateSlice("quotes", (quotes) => [
    ...quotes,
    { id: uid(), text: trimmed, author: author?.trim() || undefined },
  ]);
}

export function removeQuote(id: string): void {
  updateSlice("quotes", (quotes) => quotes.filter((q) => q.id !== id));
}

export interface ParsedQuote {
  text: string;
  author?: string;
}

/** Strip a single pair of wrapping quote marks (straight or curly). */
function stripWrappingQuotes(s: string): string {
  return s
    .replace(/^["“”'']\s*/, "")
    .replace(/\s*["“”'']$/, "")
    .trim();
}

/** Split a line into quote text + optional author at an attribution dash. */
function splitAuthor(line: string): ParsedQuote {
  // Em dash / en dash almost always marks attribution.
  const dash = line.match(/^(.*\S)\s*[—–]\s*(\S.*)$/);
  if (dash) return { text: dash[1].trim(), author: dash[2].trim() };
  // A spaced hyphen counts only when the right side looks like a short name.
  const hyphen = line.match(/^(.*\S)\s+-\s+([A-Z][^-]{1,48})$/);
  if (hyphen && hyphen[2].trim().split(/\s+/).length <= 5) {
    return { text: hyphen[1].trim(), author: hyphen[2].trim() };
  }
  return { text: line };
}

/**
 * Parse pasted/uploaded text into quotes — one per non-blank line. An author
 * may follow an em dash, en dash, or " - " (e.g. `Stay hungry. — Steve Jobs`).
 */
export function parseQuotes(raw: string): ParsedQuote[] {
  const out: ParsedQuote[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const { text, author } = splitAuthor(trimmed);
    const clean = stripWrappingQuotes(text);
    if (clean) out.push({ text: clean, author: author || undefined });
  }
  return out;
}

/**
 * Import quotes from a document, skipping any whose text already exists (so it's
 * safe to re-import an updated file). Returns how many new quotes were added.
 */
export function importQuotes(raw: string): number {
  const parsed = parseQuotes(raw);
  if (!parsed.length) return 0;
  let added = 0;
  updateSlice("quotes", (quotes) => {
    const seen = new Set<string>([
      ...DEFAULT_QUOTES.map((q) => q.text.toLowerCase()),
      ...quotes.map((q) => q.text.toLowerCase()),
    ]);
    const next = [...quotes];
    for (const p of parsed) {
      const key = p.text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      next.push({ id: uid(), text: p.text, author: p.author });
      added++;
    }
    return next;
  });
  return added;
}
