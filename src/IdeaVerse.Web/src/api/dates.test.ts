import { addDays, daysUntil, describeDue, setTimeZone, todayIso } from './dates';

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
});
