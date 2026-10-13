import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { formatDate, formatMoment } from '../api/dates';
import { activityPageSize, useActivity } from '../api/queries';
import { personLabel, statusLabels, type ActivityEntry, type IdeaStatus } from '../api/types';
import { LoadError } from '../components/ErrorMessage';
import { Skeleton } from '../components/Skeleton';

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
    case 'TagsChanged':
      return detail ? `${who} set the tags to ${detail}` : `${who} removed the tags`;
    case 'Archived':
      return `${who} archived the idea`;
    case 'Restored':
      return `${who} restored the idea`;
    case 'Rescored':
      return detail ? `${who} scored it: ${detail.toLowerCase()}` : `${who} cleared its scores`;
    case 'StartChanged':
      return detail
        ? `${who} set the start to ${describeStartDetail(detail)}`
        : `${who} cleared the start`;
  }
}

/**
 * Describes a recorded start: a moment such as `2026-11-02T13:30Z`, shown in the reader's time zone; a date alone; or, as
 * recorded before starts were kept as moments, a date with the local time it was set at.
 */
function describeStartDetail(detail: string): string {
  if (detail.endsWith('Z')) {
    return formatMoment(detail);
  }
  return `${formatDate(detail.slice(0, 10))}${detail.length > 10 ? ` at ${detail.slice(11)}` : ''}`;
}

/** The idea's history, loaded when opened, a page at a time. */
export function ActivitySection({ ideaId }: { ideaId: string }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const activity = useActivity(ideaId, page, open);
  const data = activity.data;
  const pageCount = data ? Math.max(1, Math.ceil(data.totalCount / activityPageSize)) : 1;
  const first = (page - 1) * activityPageSize + 1;
  const last = data ? first + data.items.length - 1 : first;
  const canGoBack = page > 1 && !activity.isPlaceholderData;
  const canGoOn = page < pageCount && !activity.isPlaceholderData;

  return (
    <section className="card stack" aria-labelledby="activity-heading">
      <div className="row spread">
        <h2 id="activity-heading">Activity</h2>
        <button type="button" className="button ghost small" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && activity.isLoading && <Skeleton />}
      {open && data?.totalCount === 0 && <p className="muted">Nothing has changed yet.</p>}
      {open && data && data.items.length > 0 && (
        <ol className={activity.isPlaceholderData ? 'activity loading' : 'activity'} start={first} aria-busy={activity.isPlaceholderData}>
          {data.items.map((entry) => (
            <li key={entry.id}>
              <span>{describeActivity(entry)}</span>
              <span className="muted small">{formatMoment(entry.createdAt)}</span>
            </li>
          ))}
        </ol>
      )}
      {open && data && data.totalCount > activityPageSize && (
        <nav className="row spread pager" aria-label="Activity pages">
          {/* aria-disabled rather than disabled, so focus stays on the button at the first or last page. */}
          <button type="button" className="button small" aria-disabled={!canGoBack} onClick={() => canGoBack && setPage(page - 1)}>
            <ChevronLeft aria-hidden="true" size={16} />
            Previous
          </button>
          <span className="muted small" aria-live="polite">
            {data.items.length > 0 ? `Showing ${first}–${last} of ${data.totalCount}` : `Page ${page} of ${pageCount}`}
          </span>
          <button type="button" className="button small" aria-disabled={!canGoOn} onClick={() => canGoOn && setPage(page + 1)}>
            Next
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </nav>
      )}
      <LoadError queries={activity} />
    </section>
  );
}
