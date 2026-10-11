import { useState } from 'react';

import { formatDate, formatMoment } from '../api/dates';
import { useActivity } from '../api/queries';
import { personLabel, statusLabels, type ActivityEntry, type IdeaStatus } from '../api/types';
import { ErrorMessage } from '../components/ErrorMessage';

/** Turns a history entry into a sentence, such as "Mia ticked off “Budget”". */
export function describeActivity(entry: ActivityEntry): string {
  const who = entry.actorEmail ? personLabel(entry.actorName, entry.actorEmail) : 'A former member';
  const detail = entry.detail ?? '';
  switch (entry.kind) {
    case 'Created':
      return `${who} created the idea`;
    case 'Renamed':
      return `${who} renamed it to “${detail}”`;
    case 'DescriptionChanged':
      return `${who} edited the description`;
    case 'Rescheduled':
      return `${who} moved the date to ${formatDate(detail)}`;
    case 'StatusChanged':
      return `${who} set the status to ${statusLabels[detail as IdeaStatus] ?? detail}`;
    case 'Postponed':
      return `${who} postponed it to ${formatDate(detail)}`;
    case 'ComponentAdded':
      return `${who} added “${detail}”`;
    case 'ComponentCompleted':
      return `${who} ticked off “${detail}”`;
    case 'ComponentReopened':
      return `${who} reopened “${detail}”`;
    case 'ComponentRemoved':
      return `${who} removed “${detail}”`;
    case 'MemberAdded':
      return `${who} added ${detail} to the team`;
    case 'MemberRemoved':
      return `${who} took ${detail} off the team`;
    case 'MemberLeft':
      return `${who} left the team`;
  }
}

/** The idea's history, loaded when opened. */
export function ActivitySection({ ideaId }: { ideaId: string }) {
  const [open, setOpen] = useState(false);
  const activity = useActivity(ideaId, open);

  return (
    <section className="card stack" aria-labelledby="activity-heading">
      <div className="row spread">
        <h2 id="activity-heading">Activity</h2>
        <button type="button" className="button ghost small" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && activity.isLoading && <p className="muted">Loading…</p>}
      {open && activity.data && (
        <ol className="activity">
          {activity.data.map((entry) => (
            <li key={entry.id}>
              <span>{describeActivity(entry)}</span>
              <span className="muted small">{formatMoment(entry.createdAt)}</span>
            </li>
          ))}
        </ol>
      )}
      <ErrorMessage error={activity.error} />
    </section>
  );
}
