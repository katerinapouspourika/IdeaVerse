import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { todayIso } from '../api/dates';
import type { Idea } from '../api/types';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** How many planned spans a day shows before summing up the rest, so busy months stay readable. */
const maxSpans = 3;

/**
 * A month grid with each idea on its target date, starting on the user's current month. An idea with a start date also
 * shows on its start day, as an outlined chip, with a thin line on each day in between.
 */
export function IdeaCalendar({ ideas }: { ideas: Idea[] }) {
  const today = todayIso();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, monthIndex] = month.split('-').map(Number) as [number, number];
  const title = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, monthIndex - 1, 1)),
  );

  const byDate = new Map<string, Idea[]>();
  const byStart = new Map<string, Idea[]>();
  for (const idea of ideas) {
    byDate.set(idea.targetDate, [...(byDate.get(idea.targetDate) ?? []), idea]);
    if (idea.startDate && idea.startDate < idea.targetDate) {
      byStart.set(idea.startDate, [...(byStart.get(idea.startDate) ?? []), idea]);
    }
  }
  // Earliest start first, so an idea's line keeps roughly the same place from day to day.
  const planned = ideas
    .filter((i) => i.startDate && i.startDate < i.targetDate)
    .sort((a, b) => a.startDate!.localeCompare(b.startDate!) || a.targetDate.localeCompare(b.targetDate));
  const spanning = (date: string) => planned.filter((i) => i.startDate! < date && date < i.targetDate);
  const chipClass = (idea: Idea) => `status-${idea.status.toLowerCase()}${idea.isOverdue ? ' is-overdue' : ''}`;

  return (
    <section className="card stack" aria-labelledby="calendar-heading">
      <div className="row spread calendar-nav">
        <button type="button" className="button ghost" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft aria-hidden="true" size={18} /> <span className="calendar-nav-label">Previous month</span>
        </button>
        <h2 id="calendar-heading">{title}</h2>
        <button type="button" className="button ghost" onClick={() => setMonth(shiftMonth(month, 1))}>
          <span className="calendar-nav-label">Next month</span> <ChevronRight aria-hidden="true" size={18} />
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
                      <Link key={idea.id} to={`/ideas/${idea.id}`} className={`calendar-idea ${chipClass(idea)}`}>
                        {idea.title}
                      </Link>
                    ))}
                    {byStart.get(date)?.map((idea) => (
                      <Link
                        key={`start-${idea.id}`}
                        to={`/ideas/${idea.id}`}
                        aria-label={`Starts: ${idea.title}`}
                        className={`calendar-idea calendar-start ${chipClass(idea)}`}
                      >
                        {idea.title}
                      </Link>
                    ))}
                    <Spans ideas={spanning(date)} className={chipClass} />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {planned.length > 0 && (
        <p className="small muted calendar-legend">
          <span className="calendar-idea calendar-start status-planned">Outlined</span> on the start day, filled on the target date,
          with a line on each day in between.
        </p>
      )}
    </section>
  );
}

/** The thin lines of the ideas under way on a day, up to `maxSpans`; their start and target chips name them. */
function Spans({ ideas, className }: { ideas: Idea[]; className: (idea: Idea) => string }) {
  if (ideas.length === 0) {
    return null;
  }
  return (
    <span className="calendar-spans" aria-hidden="true">
      {ideas.slice(0, maxSpans).map((idea) => (
        <span key={idea.id} className={`calendar-span ${className(idea)}`} title={idea.title} />
      ))}
      {ideas.length > maxSpans && <span className="calendar-more">+{ideas.length - maxSpans}</span>}
    </span>
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
