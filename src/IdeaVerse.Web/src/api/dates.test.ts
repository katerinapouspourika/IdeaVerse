import { addDays, daysUntil, describeDue, formatAgo, formatDate, formatMoment, setTimeZone, todayIso } from './dates';

describe('dates', () => {
  const now = new Date('2026-10-10T23:30:00Z');

  beforeEach(() => setTimeZone('UTC'));

  it('uses the calendar day of the given time zone for today', () => {
    expect(todayIso(now, 'UTC')).toBe('2026-10-10');
    expect(todayIso(now, 'Europe/Athens')).toBe('2026-10-11');
    expect(todayIso(now, 'America/Phoenix')).toBe('2026-10-10');
  });

  it('describes due dates against the time zone that was set', () => {
    setTimeZone('Europe/Athens');
    expect(describeDue('2026-10-11', now)).toBe('today');
    setTimeZone('UTC');
    expect(describeDue('2026-10-11', now)).toBe('tomorrow');
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });

  it.each([
    ['2026-10-10', 'today'],
    ['2026-10-11', 'tomorrow'],
    ['2026-10-15', 'in 5 days'],
    ['2026-10-09', '1 day ago'],
    ['2026-10-01', '9 days ago'],
  ])('describes %s as "%s"', (date, expected) => {
    expect(describeDue(date, now)).toBe(expected);
  });

  it('counts days until a date', () => {
    expect(daysUntil('2026-10-17', now)).toBe(7);
  });

  it.each([
    ['2026-10-10T23:29:40Z', 'just now'],
    ['2026-10-10T23:05:00Z', '25 min ago'],
    ['2026-10-10T21:10:00Z', '2 h ago'],
    ['2026-10-09T23:45:00Z', 'yesterday'],
    ['2026-10-07T12:00:00Z', '3 days ago'],
  ])('describes a moment at %s as "%s"', (moment, expected) => {
    expect(formatAgo(moment, now, 'UTC')).toBe(expected);
  });

  it('counts days ago by the calendar of the time zone', () => {
    // 06:00 UTC on the 10th is still 23:00 on the 9th in Phoenix (UTC-7), where it is now 16:30 on the 10th.
    expect(formatAgo('2026-10-10T06:00:00Z', now, 'America/Phoenix')).toBe('yesterday');
    expect(formatAgo('2026-10-10T06:00:00Z', now, 'UTC')).toBe('17 h ago');
  });

  it('gives the date for moments over a week ago', () => {
    expect(formatAgo('2026-10-01T09:00:00Z', now, 'UTC')).toBe(formatDate('2026-10-01'));
  });

  it('writes the hour as the locale normally does, without a leading zero on a 12-hour clock', () => {
    const twelveHour = /^h1[12]$/.test(new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle ?? '');
    const moment = formatMoment('2026-10-10T09:30:00Z', 'UTC');
    expect(moment).toContain('9:30');
    if (twelveHour) {
      expect(moment).not.toContain('09:30');
    }
  });
});
