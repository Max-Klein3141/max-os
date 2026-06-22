/**
 * Per-day dismissals of the Today warning banners, so a banner the user closes
 * stays closed for the rest of that day but returns fresh tomorrow. Shape:
 * `{ [dateKey]: string[] }` keyed by banner id.
 */
const KEY = "maxos_banner_dismissals";

type Store = Record<string, string[]>;

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Store;
  } catch {
    return {};
  }
}

/** Banner ids dismissed for the given day. */
export function getDismissals(dateKey: string): string[] {
  return read()[dateKey] ?? [];
}

/** Mark a banner dismissed for the given day. Returns the updated id list. */
export function dismissBanner(dateKey: string, id: string): string[] {
  const all = read();
  const next = Array.from(new Set([...(all[dateKey] ?? []), id]));
  all[dateKey] = next;
  // Keep the store from growing forever — only retain today's dismissals.
  for (const k of Object.keys(all)) if (k !== dateKey) delete all[k];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore quota errors — dismissal is non-critical */
  }
  return next;
}
