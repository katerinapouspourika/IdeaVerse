import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { daysUntil, describeDue, formatDate } from '../api/dates';
import { BrainstormPanel, describeBrainstormed } from '../ai/BrainstormPanel';
import { useAiStatus, useIdeas, useTags } from '../api/queries';
import { personLabel, sortLabels, statuses, statusLabels, type Idea, type IdeaSort, type IdeaStatus, type Workspace } from '../api/types';
import { Field } from '../components/Field';
import { ErrorMessage } from '../components/ErrorMessage';
import { Progress } from '../components/Progress';
import { StatusBadge } from '../components/StatusBadge';
import { Tags } from '../components/Tags';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { IdeaCalendar } from './IdeaCalendar';
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

/** Which ideas the status tabs show: all active ones, one status, or the archive. */
type Tab = IdeaStatus | 'All' | 'Archived';

function WorkspaceIdeas({ workspace }: { workspace: Workspace }) {
  const [tab, setTab] = useState<Tab>('All');
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<IdeaSort>('TargetDate');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const location = useLocation();
  const [adding, setAdding] = useState<{ title: string; description: string } | null>(
    (location.state as { adding?: boolean } | null)?.adding ? { title: '', description: '' } : null,
  );
  const [brainstorming, setBrainstorming] = useState(false);
  const debouncedSearch = useDebounced(search, 250);
  const archived = tab === 'Archived';
  const status = tab === 'All' || archived ? undefined : tab;
  const ideas = useIdeas(workspace.id, { status, search: debouncedSearch, tag: tag || undefined, sort, archived });
  const tags = useTags(workspace.id);
  const ai = useAiStatus(workspace.id);
  const filtered = status !== undefined || debouncedSearch.trim() !== '' || tag !== '';

  return (
    <div className="stack">
      <div className="row spread wrap">
        <h1>Ideas</h1>
        {!adding && (
          <div className="row">
            {ai.data?.enabled && !brainstorming && (
              <button type="button" className="button ghost" onClick={() => setBrainstorming(true)}>
                Brainstorm with AI
              </button>
            )}
            <button type="button" className="button primary" onClick={() => setAdding({ title: '', description: '' })}>
              New idea
            </button>
          </div>
        )}
      </div>

      {adding && (
        <NewIdeaForm
          key={adding.title}
          workspaceId={workspace.id}
          initial={adding}
          onDone={() => setAdding(null)}
        />
      )}
      {brainstorming && (
        <BrainstormPanel
          workspaceId={workspace.id}
          onPick={(idea) => setAdding({ title: idea.title, description: describeBrainstormed(idea) })}
          onClose={() => setBrainstorming(false)}
        />
      )}

      <nav className="tabs" aria-label="Filter by status">
        <FilterTab label="All" active={tab === 'All'} onClick={() => setTab('All')} />
        {statuses.map((s) => (
          <FilterTab key={s} label={statusLabels[s]} active={tab === s} onClick={() => setTab(s)} />
        ))}
        <FilterTab label="Archived" active={archived} onClick={() => setTab('Archived')} />
      </nav>

      <div className="row wrap end toolbar">
        <Field label="Search">
          {(props) => (
            <input {...props} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title or description" />
          )}
        </Field>
        {tags.data && tags.data.length > 0 && (
          <Field label="Tag">
            {(props) => (
              <select {...props} value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">All tags</option>
                {tags.data.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field label="Sort by">
          {(props) => (
            <select {...props} value={sort} onChange={(e) => setSort(e.target.value as IdeaSort)}>
              {(Object.keys(sortLabels) as IdeaSort[]).map((s) => (
                <option key={s} value={s}>
                  {sortLabels[s]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="tabs" role="group" aria-label="View">
          <FilterTab label="List" active={view === 'list'} onClick={() => setView('list')} />
          <FilterTab label="Calendar" active={view === 'calendar'} onClick={() => setView('calendar')} />
        </div>
      </div>

      {ideas.isLoading && <p className="muted">Loading ideas…</p>}
      <ErrorMessage error={ideas.error} />
      {ideas.data &&
        (view === 'calendar' ? (
          <IdeaCalendar ideas={ideas.data} />
        ) : (
          <IdeaList ideas={ideas.data} filtered={filtered} archived={archived} />
        ))}
    </div>
  );
}

/** `value`, once it has stopped changing for `delay` milliseconds. */
function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

function FilterTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={active ? 'tab active' : 'tab'} aria-pressed={active} onClick={onClick}>
      {label}
    </button>
  );
}

function IdeaList({ ideas, filtered, archived }: { ideas: Idea[]; filtered: boolean; archived: boolean }) {
  if (ideas.length === 0) {
    return (
      <div className="card empty">
        <p>
          {filtered
            ? 'No ideas match.'
            : archived
              ? 'Nothing archived. Archive an idea you’ve set aside to keep it out of the list without deleting it.'
              : 'No ideas yet. Add your first one and give it a date.'}
        </p>
      </div>
    );
  }

  const overdue = ideas.filter((i) => i.isOverdue).length;
  const dueSoon = archived ? 0 : ideas.filter((i) => i.status !== 'Done' && !i.isOverdue && daysUntil(i.targetDate) <= 7).length;

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
              <div className="row small muted wrap">
                <span>{describeTeam(idea)}</span>
                {idea.postponeCount > 0 && <span>Postponed {idea.postponeCount}×</span>}
                <Tags tags={idea.tags} />
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
  const owner = personLabel(idea.ownerName, idea.ownerEmail);
  return idea.role === 'Member' ? `You’re on ${owner}’s team` : `By ${owner}`;
}
