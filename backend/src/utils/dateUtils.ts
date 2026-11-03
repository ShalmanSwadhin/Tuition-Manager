// All class/diary dates are stored as "YYYY-MM-DD" strings representing the
// Asia/Dhaka calendar date. This sidesteps UTC-offset bugs entirely: no
// Date-object day-boundary math is needed anywhere else in the app.

const DHAKA_OFFSET_MINUTES = 6 * 60; // UTC+6, no DST

export function nowInDhaka(): Date {
  const utc = new Date();
  return new Date(utc.getTime() + DHAKA_OFFSET_MINUTES * 60000);
}

export function todayDhakaStr(): string {
  return toDateStr(nowInDhaka());
}

export function toDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isValidDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

// Returns [startInclusive, endInclusive] as "YYYY-MM-DD" strings for a given
// Dhaka calendar month (1-12).
export function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}
