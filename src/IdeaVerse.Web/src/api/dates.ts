/** The browser's IANA time zone, such as `Europe/Athens`. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

let currentTimeZone = browserTimeZone();

/** Sets the time zone whose calendar decides "today"; the signed-in account's, matching the API. */
export function setTimeZone(timeZone: string) {
  currentTimeZone = timeZone;
}

/** Today's date in a time zone as `YYYY-MM-DD`; by default the account's, as the API decides "today" and "overdue". */
export function todayIso(now: Date = new Date(), timeZone: string = currentTimeZone): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** The hour of the day, 0–23, in a time zone; by default the account's, so a greeting follows the user's own clock. */
export function hourIn(now: Date = new Date(), timeZone: string = currentTimeZone): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now));
}

/** Adds days to a `YYYY-MM-DD` date. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Adds calendar months to a `YYYY-MM-DD` date, keeping the day where the month has it and otherwise taking the month's last day. */
export function addMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

/** Whole days from today until the date; negative when it has passed. */
export function daysUntil(isoDate: string, now: Date = new Date(), timeZone: string = currentTimeZone): number {
  const day = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${todayIso(now, timeZone)}T00:00:00Z`)) / day);
}

/** A friendly description such as "in 3 days", "today", or "5 days overdue". */
export function describeDue(isoDate: string, now: Date = new Date(), timeZone: string = currentTimeZone): string {
  const days = daysUntil(isoDate, now, timeZone);
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

/** Formats the day a moment, such as when an idea was created, fell on in the account's time zone, e.g. "Fri, 23 Oct 2026". */
export function formatDayOf(isoInstant: string, timeZone: string = currentTimeZone): string {
  return formatDate(todayIso(new Date(isoInstant), timeZone));
}

/** Formats a moment, such as when a comment was posted, in the account's time zone, e.g. "Sat, 10 Oct 2026, 14:32". */
export function formatMoment(isoInstant: string, timeZone: string = currentTimeZone): string {
  return new Date(isoInstant).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

/** When something happened, relative to now in the account's time zone: "just now", "5 min ago", "2 h ago", "yesterday", "3 days ago", or the date after a week. */
export function formatAgo(isoInstant: string, now: Date = new Date(), timeZone: string = currentTimeZone): string {
  const then = new Date(isoInstant);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const day = todayIso(then, timeZone);
  const days = -daysUntil(day, now, timeZone);
  if (days === 0) return `${Math.floor(minutes / 60)} h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(day);
}

/** Formats when an idea starts: its date, with the time in the account's time zone when one was given. */
export function formatStart(idea: { startDate: string | null; startTime: string | null; startsAt: string | null }): string | null {
  if (!idea.startDate) return null;
  return idea.startTime && idea.startsAt ? formatMoment(idea.startsAt) : formatDate(idea.startDate);
}
