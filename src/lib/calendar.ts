import type { Todo } from "../types";
import { parseKey } from "./dates";

const MIN_PER_DAY = 24 * 60;

/** Clamp minutes-from-midnight into a valid same-day value. */
export function clampMinutes(min: number): number {
  return Math.max(0, Math.min(MIN_PER_DAY - 1, Math.round(min)));
}

/** Friendly clock label, e.g. 540 → "9:00 AM". */
export function timeLabel(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Minutes-from-midnight → "HH:MM" for an <input type="time">. */
export function toTimeInput(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Parse "HH:MM" into minutes from midnight, or null if malformed. */
export function fromTimeInput(value: string): number | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

/** Compact duration label, e.g. 90 → "1h 30m". */
export function durationLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Whether a todo carries a complete time-box. */
export function isScheduled(
  todo: Todo,
): todo is Todo & { startMin: number; durationMin: number } {
  return todo.startMin != null && todo.durationMin != null;
}

/** Start/end Dates for a scheduled todo (local wall-clock), or null. */
export function blockTimes(todo: Todo): { start: Date; end: Date } | null {
  if (!isScheduled(todo)) return null;
  const start = parseKey(todo.date);
  start.setHours(0, todo.startMin, 0, 0);
  const end = new Date(start.getTime() + todo.durationMin * 60000);
  return { start, end };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local floating timestamp `yyyyMMddThhmmss` (no timezone marker). */
function floatingStamp(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}00`
  );
}

/** UTC timestamp `yyyyMMddThhmmssZ`, used for DTSTAMP. */
function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * A Google Calendar "create event" URL for a scheduled todo. Opening it
 * pre-fills a new event at the chosen time — no login or API needed.
 */
export function googleCalendarUrl(todo: Todo): string | null {
  const times = blockTimes(todo);
  if (!times) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: todo.text,
    dates: `${floatingStamp(times.start)}/${floatingStamp(times.end)}`,
    details: "Time-boxed in MAX OS",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Build an iCalendar (.ics) document from a set of scheduled todos. */
export function buildICS(todos: Todo[]): string {
  const stamp = utcStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MAX OS//Planner//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const todo of todos) {
    const times = blockTimes(todo);
    if (!times) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${todo.id}@max-os`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${floatingStamp(times.start)}`,
      `DTEND:${floatingStamp(times.end)}`,
      `SUMMARY:${icsEscape(todo.text)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** Trigger a download of an .ics file in the browser. */
export function downloadICS(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
