import { useState } from 'react';
import { Link } from 'react-router';

import { todayIso } from '../api/dates';
import type { Idea } from '../api/types';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A month grid with each idea on its target date, starting on the user's current month. */
export function IdeaCalendar({ ideas }: { ideas: Idea[] }) {
  const today = todayIso();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, monthIndex] = month.split('-').map(Number) as [number, number];
  const title = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, monthIndex - 1, 1)),
  );

  const byDate = new Map<string, Idea[]>();
  for (const idea of ideas) {
    byDate.set(idea.targetDate, [...(byDate.get(idea.targetDate) ?? []), idea]);
  }

  return (
    <section className="card stack" aria-labelledby="calendar-heading">
      <div className="row spread">
        <button type="button" className="button ghost" onClick={() => setMonth(shiftMonth(month, -1))}>
          ← Previous month
        </button>
        <h2 id="calendar-heading">{title}</h2>
        <button type="button" className="button ghost" onClick={() => setMonth(shiftMonth(month, 1))}>
          Next month →
        </button>
      </div>
      <table className="calendar">
        <thead>
          <tr>
            {weekdays.map((d) => (
              <th key={d} scope="col">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeksOf(year, monthIndex).map((week) => (
            <tr key={week.join()}>
              {week.map((date, i) =>
                date === null ? (
                  <td key={i} className="outside" />
                ) : (
                  <td key={date} className={date === today ? 'today' : undefined}>
                    <span className="day">{Number(date.slice(8))}</span>
                    {byDate.get(date)?.map((idea) => (
                      <Link
                        key={idea.id}
                        to={`/ideas/${idea.id}`}
                        className={idea.isOverdue ? 'calendar-idea is-overdue' : idea.status === 'Done' ? 'calendar-idea is-done' : 'calendar-idea'}
                      >
                        {idea.title}
                      </Link>
                    ))}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** `YYYY-MM` moved by `months`. */
function shiftMonth(month: string, months: number): string {
  const [year, monthIndex] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, monthIndex - 1 + months, 1)).toISOString().slice(0, 7);
}

/** The month's dates as Monday-first weeks, padded with `null` outside the month. */
function weeksOf(year: number, monthIndex: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, monthIndex - 1, 1));
  const days = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: (first.getUTCDay() + 6) % 7 }, () => null);
  for (let day = 1; day <= days; day++) {
    cells.push(new Date(Date.UTC(year, monthIndex - 1, day)).toISOString().slice(0, 10));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}
