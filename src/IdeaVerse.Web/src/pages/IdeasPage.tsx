import { useState } from 'react';
import { Link } from 'react-router';

import { daysUntil, describeDue, formatDate } from '../api/dates';
import { useIdeas } from '../api/queries';
import { statuses, statusLabels, type Idea, type IdeaStatus, type Workspace } from '../api/types';
import { ErrorMessage } from '../components/ErrorMessage';
import { Progress } from '../components/Progress';
import { StatusBadge } from '../components/StatusBadge';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { NewIdeaForm } from './NewIdeaForm';
import { WelcomePage } from './WelcomePage';

export function IdeasPage() {
  const { current, isLoading, error } = useWorkspace();

  if (isLoading) {
    return <p className="muted">Loading…</p>;
  }

  if (!current) {
    return error ? <ErrorMessage error={error} /> : <WelcomePage />;
  }

  return <WorkspaceIdeas key={current.id} workspace={current} />;
}

function WorkspaceIdeas({ workspace }: { workspace: Workspace }) {
  const [status, setStatus] = useState<IdeaStatus | undefined>();
  const [adding, setAdding] = useState(false);
  const ideas = useIdeas(workspace.id, status);

  return (
    <div className="stack">
      <div className="row spread">
        <h1>Ideas</h1>
        {!adding && (
          <button type="button" className="button primary" onClick={() => setAdding(true)}>
            New idea
          </button>
        )}
      </div>

      {adding && <NewIdeaForm workspaceId={workspace.id} onDone={() => setAdding(false)} />}

      <nav className="tabs" aria-label="Filter by status">
        <FilterTab label="All" active={status === undefined} onClick={() => setStatus(undefined)} />
        {statuses.map((s) => (
          <FilterTab key={s} label={statusLabels[s]} active={status === s} onClick={() => setStatus(s)} />
        ))}
      </nav>

      {ideas.isLoading && <p className="muted">Loading ideas…</p>}
      <ErrorMessage error={ideas.error} />
      {ideas.data && <IdeaList ideas={ideas.data} filtered={status !== undefined} />}
    </div>
  );
}

function FilterTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={active ? 'tab active' : 'tab'} aria-pressed={active} onClick={onClick}>
      {label}
    </button>
  );
}

function IdeaList({ ideas, filtered }: { ideas: Idea[]; filtered: boolean }) {
  if (ideas.length === 0) {
    return (
      <div className="card empty">
        <p>{filtered ? 'No ideas with this status.' : 'No ideas yet. Add your first one and give it a date.'}</p>
      </div>
    );
  }

  const overdue = ideas.filter((i) => i.isOverdue).length;
  const dueSoon = ideas.filter((i) => i.status !== 'Done' && !i.isOverdue && daysUntil(i.targetDate) <= 7).length;

  return (
    <>
      {(overdue > 0 || dueSoon > 0) && (
        <p className="summary" role="status">
          {overdue > 0 && <span className="overdue-text">{overdue} overdue</span>}
          {overdue > 0 && dueSoon > 0 && ' · '}
          {dueSoon > 0 && <span>{dueSoon} due within a week</span>}
        </p>
      )}
      <ul className="idea-list">
        {ideas.map((idea) => (
          <li key={idea.id}>
            <Link to={`/ideas/${idea.id}`} className={idea.isOverdue ? 'card idea-card is-overdue' : 'card idea-card'}>
              <div className="row spread">
                <h2 className="idea-title">{idea.title}</h2>
                <StatusBadge idea={idea} />
              </div>
              <div className="row spread wrap">
                <span>
                  <strong>{formatDate(idea.targetDate)}</strong>{' '}
                  <span className={idea.isOverdue ? 'overdue-text' : 'muted'}>({describeDue(idea.targetDate)})</span>
                </span>
                <Progress done={idea.completedComponentCount} total={idea.componentCount} />
              </div>
              <div className="row small muted">
                <span>{describeTeam(idea)}</span>
                {idea.postponeCount > 0 && <span>Postponed {idea.postponeCount}×</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Who the idea belongs to, from the user's point of view. */
function describeTeam(idea: Idea): string {
  if (idea.role === 'Owner') {
    return idea.memberCount === 0 ? 'Only you' : `You + ${idea.memberCount}`;
  }
  return idea.role === 'Member' ? `You’re on ${idea.ownerEmail}’s team` : `By ${idea.ownerEmail}`;
}
