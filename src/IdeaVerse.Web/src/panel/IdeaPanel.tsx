import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { Link } from 'react-router';

import { ApiError } from '../api/client';
import { describeDue, formatDate } from '../api/dates';
import { useIdea } from '../api/queries';
import { ErrorMessage } from '../components/ErrorMessage';
import { Progress } from '../components/Progress';
import { Skeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { Tags } from '../components/Tags';
import { ComponentsSection } from '../pages/ComponentsSection';
import { PriorityCard } from '../priority/PriorityCard';

const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * An idea's essentials in a panel over the list: its details, priority, and checklist, with a link to the full page.
 * Escape, the close button, or a click beside it closes it; focus stays inside while it is open and returns afterwards.
 */
export function IdeaPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const idea = useIdea(id);
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Tab') {
      const items = [...(panel.current?.querySelectorAll<HTMLElement>(focusable) ?? [])];
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} className="drawer stack" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
        <div className="row spread drawer-bar">
          <Link to={`/ideas/${id}`} className="button ghost small">
            <ExternalLink aria-hidden="true" size={16} />
            Open full page
          </Link>
          <button ref={closeButton} type="button" className="button ghost small icon-button" aria-label="Close" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        {idea.isLoading && (
          <>
            <h2 id={titleId} className="visually-hidden">
              Loading idea
            </h2>
            <Skeleton variant="page" lines={4} />
          </>
        )}
        {idea.error && (
          <>
            <h2 id={titleId}>Idea unavailable</h2>
            {idea.error instanceof ApiError && idea.error.status === 404 ? (
              <p className="muted">This idea doesn’t exist or isn’t in one of your workspaces.</p>
            ) : (
              <ErrorMessage error={idea.error} />
            )}
          </>
        )}
        {idea.data && (
          <>
            <section className="card stack">
              <div className="row wrap">
                <h2 id={titleId} className="drawer-title">
                  {idea.data.title}
                </h2>
                <StatusBadge idea={idea.data} />
              </div>
              <p className="small">
                Implement by <strong>{formatDate(idea.data.targetDate)}</strong>{' '}
                <span className={idea.data.isOverdue ? 'overdue-text' : 'muted'}>({describeDue(idea.data.targetDate)})</span>
              </p>
              <Tags tags={idea.data.tags} />
              {idea.data.description ? <p className="description">{idea.data.description}</p> : <p className="muted">No description yet.</p>}
              <Progress done={idea.data.completedComponentCount} total={idea.data.componentCount} />
            </section>
            <PriorityCard idea={idea.data} />
            <ComponentsSection ideaId={idea.data.id} workspaceId={idea.data.workspaceId} canEdit={idea.data.canEdit} />
          </>
        )}
      </div>
    </div>
  );
}
