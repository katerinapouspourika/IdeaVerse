import { addDays, daysUntil, describeDue, todayIso } from './dates';

describe('dates', () => {
  const now = new Date('2026-10-10T23:30:00Z');

  it('uses the UTC calendar day for today', () => {
    expect(todayIso(now)).toBe('2026-10-10');
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
