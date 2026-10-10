/** Today's date in UTC as `YYYY-MM-DD`, matching how the API decides "today" and "overdue". */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Adds days to a `YYYY-MM-DD` date. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole days from today until the date; negative when it has passed. */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const day = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${todayIso(now)}T00:00:00Z`)) / day);
}

/** A friendly description such as "in 3 days", "today", or "5 days overdue". */
export function describeDue(isoDate: string, now: Date = new Date()): string {
  const days = daysUntil(isoDate, now);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1) return `in ${days} days`;
  return days === -1 ? '1 day ago' : `${-days} days ago`;
}

/** Formats a `YYYY-MM-DD` date for display, e.g. "Fri, 23 Oct 2026". */
export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
