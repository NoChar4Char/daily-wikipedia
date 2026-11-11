// The site's "day" rolls over at 04:00 in UTC+8 (= 20:00 UTC the previous day).
// Shared by the browser and the generator script so both agree on today's date.

export const RESET_UTC_OFFSET_HOURS = 8;
export const RESET_HOUR = 4;

const HOUR_MS = 60 * 60 * 1000;
const SHIFT_MS = (RESET_UTC_OFFSET_HOURS - RESET_HOUR) * HOUR_MS;

/** Date key ("YYYY-MM-DD") of the site-day that contains `date`. */
export function dayKey(date = new Date()) {
  return new Date(date.getTime() + SHIFT_MS).toISOString().slice(0, 10);
}

/** The instant the next site-day begins. */
export function nextReset(date = new Date()) {
  const start = Date.parse(`${dayKey(date)}T00:00:00Z`) - SHIFT_MS;
  return new Date(start + 24 * HOUR_MS);
}

/** Add `days` to a "YYYY-MM-DD" key. */
export function addDays(key, days) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
