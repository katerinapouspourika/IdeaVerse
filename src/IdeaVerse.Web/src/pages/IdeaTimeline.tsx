import { Link } from 'react-router';

import { describeDue, formatDate, todayIso } from '../api/dates';
import { statusLabels, type Idea } from '../api/types';
import { useIdeaPanel } from '../panel/useIdeaPanel';

/** The width of a month on the scale, so a long roadmap scrolls sideways rather than squeezing its bars. */
const monthWidth = 110;

const day = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000;
const monthStart = (year: number, month: number) => new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);

/** The months the timeline shows: from the month before this one to the month of the latest target date, at least three months. */
function monthsFor(ideas: Idea[], today: string): string[] {
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1];
  const latest = ideas.reduce((max, i) => (i.targetDate > max ? i.targetDate : max), today);
  const months: string[] = [];
  for (let i = -1; ; i++) {
    const start = monthStart(y, m + i);
    if (i >= 2 && start > latest) {
      break;
    }
    months.push(start);
  }
  return months;
}

/**
 * A roadmap of the ideas: each is a bar from the day it was added to its target date, against a scale of months with a
 * line for today. Each row also says its dates in words, which is what screen readers read; the bars are decoration.
 */
export function IdeaTimeline({ ideas }: { ideas: Idea[] }) {
  const { linkProps } = useIdeaPanel();
  const today = todayIso();
  const months = monthsFor(ideas, today);
  const from = day(months[0]!);
  const last = months[months.length - 1]!;
  const to = day(monthStart(Number(last.slice(0, 4)), Number(last.slice(5, 7))));
  const span = to - from;
  const at = (iso: string) => Math.min(Math.max(((day(iso) - from) / span) * 100, 0), 100);
  const sorted = [...ideas].sort((a, b) => a.targetDate.localeCompare(b.targetDate) || a.title.localeCompare(b.title));
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });
  const yearName = new Intl.DateTimeFormat(undefined, { year: 'numeric', timeZone: 'UTC' });

  if (ideas.length === 0) {
    return <p className="card muted">No ideas to show on the timeline.</p>;
  }

  return (
    <section className="card timeline" aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="visually-hidden">
        Timeline
      </h2>
      <div className="timeline-scroll">
        <div className="timeline-grid" style={{ minWidth: `calc(220px + ${months.length * monthWidth}px)` }}>
          <div className="timeline-scale" aria-hidden="true">
            <span />
            <div className="timeline-track">
              {months.map((m, i) => (
                <span key={m} className="timeline-month" style={{ left: `${at(m)}%` }}>
                  {monthName.format(new Date(`${m}T00:00:00Z`))}
                  {(i === 0 || m.endsWith('-01-01')) && <small> {yearName.format(new Date(`${m}T00:00:00Z`))}</small>}
                </span>
              ))}
              <span className="timeline-today" style={{ left: `${at(today)}%` }}>
                Today
              </span>
            </div>
          </div>
          <ol className="timeline-rows">
            {sorted.map((idea) => {
              const start = idea.createdAt.slice(0, 10) < idea.targetDate ? idea.createdAt.slice(0, 10) : idea.targetDate;
              const left = at(start);
              const width = Math.max(at(idea.targetDate) - left, 0.8);
              const state = idea.isOverdue ? 'is-overdue' : `status-${idea.status.toLowerCase()}`;
              return (
                <li key={idea.id} className="timeline-row">
                  <div className="timeline-label">
                    {/* Stretched over the whole row, bar included, so a click anywhere on it opens the idea. */}
                    <Link {...linkProps(idea.id)} className="timeline-title stretched-link">
                      {idea.title}
                    </Link>
                    <span className={idea.isOverdue ? 'small overdue-text' : 'small muted'}>
                      {statusLabels[idea.status]} · {formatDate(idea.targetDate)} ({describeDue(idea.targetDate)})
                    </span>
                  </div>
                  <div className="timeline-track" aria-hidden="true">
                    <span className="timeline-today-line" style={{ left: `${at(today)}%` }} />
                    <span className={`timeline-bar ${state}${day(start) < from ? ' clipped' : ''}`} style={{ left: `${left}%`, width: `${width}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
