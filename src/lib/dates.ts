import {
  addDays,
  eachDayOfInterval,
  endOfISOWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  startOfISOWeek,
  subDays,
} from "date-fns";

/** Format a Date as a `yyyy-MM-dd` date key. */
export function dateKey(d: Date = new Date()): string {
  return format(d, "yyyy-MM-dd");
}

/** Today's date key. */
export function todayKey(): string {
  return dateKey(new Date());
}

/** Parse a `yyyy-MM-dd` date key into a local Date at midnight. */
export function parseKey(key: string): Date {
  return parseISO(key);
}

/** ISO week key, e.g. "2026-W25". */
export function isoWeekKey(d: Date = new Date()): string {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}

/** The seven Date objects (Mon–Sun) of the ISO week containing `d`. */
export function isoWeekDays(d: Date): Date[] {
  return eachDayOfInterval({ start: startOfISOWeek(d), end: endOfISOWeek(d) });
}

/** Array of the last `n` calendar days as Dates, oldest → newest, ending today. */
export function recentDays(n: number, asOf: Date = new Date()): Date[] {
  const out: Date[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(subDays(asOf, i));
  return out;
}

export { addDays, subDays };

/** Human-friendly date, e.g. "Jun 20, 2026". */
export function humanDate(key: string): string {
  return format(parseKey(key), "MMM d, yyyy");
}

/** Short weekday + day, e.g. "Sat 20". */
export function shortDay(d: Date): string {
  return format(d, "EEE d");
}

/** Full descriptive date, e.g. "Saturday, June 20". */
export function longDate(d: Date = new Date()): string {
  return format(d, "EEEE, MMMM d");
}

/** Time-of-day greeting. */
export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}
