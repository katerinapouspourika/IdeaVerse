import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { formatDate, todayIso } from '../api/dates';
import type { Idea } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';
import { useNarrowScreen } from '../components/useNarrowScreen';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * A month grid with each idea on its target date, starting on the user's current month. On a phone, where a grid's
 * cells are too small to read, the month's ideas are a list grouped by target date instead.
 */
export function IdeaCalendar({ ideas }: { ideas: Idea[] }) {
  const narrow = useNarrowScreen();
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

  const nav = (
    <div className="row spread calendar-nav">
      <button type="button" className="button ghost" onClick={() => setMonth(shiftMonth(month, -1))}>
        <ChevronLeft aria-hidden="true" size={18} /> <span className="calendar-nav-label">Previous month</span>
      </button>
      <h2 id="calendar-heading">{title}</h2>
      <button type="button" className="button ghost" onClick={() => setMonth(shiftMonth(month, 1))}>
        <span className="calendar-nav-label">Next month</span> <ChevronRight aria-hidden="true" size={18} />
      </button>
    </div>
  );

  if (narrow) {
    return (
      <section className="card stack" aria-labelledby="calendar-heading">
        {nav}
        <CalendarAgenda month={month} title={title} byDate={byDate} today={today} />
      </section>
    );
  }

  return (
    <section className="card stack" aria-labelledby="calendar-heading">
      {nav}
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
                        className={`calendar-idea status-${idea.status.toLowerCase()}${idea.isOverdue ? ' is-overdue' : ''}`}
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

interface CalendarAgendaProps {
  month: string;
  title: string;
  byDate: Map<string, Idea[]>;
  today: string;
}

/** The month's ideas as a list grouped by target date, each noting when work starts, for screens too narrow for a grid. */
function CalendarAgenda({ month, title, byDate, today }: CalendarAgendaProps) {
  const days = [...byDate.keys()].filter((date) => date.startsWith(month)).sort();
  if (days.length === 0) {
    return <p className="muted">No ideas due in {title}.</p>;
  }

  return (
    <ol className="agenda">
      {days.map((date) => (
        <li key={date} className="agenda-day">
          <h3 className="agenda-date">
            {formatDate(date)}
            {date === today && <span className="agenda-today">Today</span>}
          </h3>
          <ul className="agenda-ideas">
            {byDate.get(date)!.map((idea) => (
              <li key={idea.id} className={`agenda-idea status-${idea.status.toLowerCase()}${idea.isOverdue ? ' is-overdue' : ''}`}>
                <Link to={`/ideas/${idea.id}`} className="agenda-title stretched-link">
                  {idea.title}
                </Link>
                <span className="row small muted wrap">
                  <StatusBadge idea={idea} />
                  {idea.startDate && idea.startDate < idea.targetDate && <span>From {formatDate(idea.startDate)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
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
