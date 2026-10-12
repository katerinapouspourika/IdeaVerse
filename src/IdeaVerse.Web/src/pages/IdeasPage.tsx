import { useEffect, useState } from 'react';
import { Archive, Lightbulb, Plus, SearchX } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { daysUntil, describeDue, formatDate } from '../api/dates';
import { BrainstormPanel, describeBrainstormed } from '../ai/BrainstormPanel';
import { useAiStatus, useIdeas, useTags } from '../api/queries';
import { personLabel, sortLabels, statuses, statusLabels, type Idea, type IdeaSort, type IdeaStatus, type Workspace } from '../api/types';
import { Field } from '../components/Field';
import { ErrorMessage } from '../components/ErrorMessage';
import { Progress } from '../components/Progress';
import { Skeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { Tags } from '../components/Tags';
import { IdeaPanel } from '../panel/IdeaPanel';
import { useIdeaPanel } from '../panel/useIdeaPanel';
import { IdeaMatrix } from '../priority/IdeaMatrix';
import { VoteButton } from '../priority/VoteButton';
import { usePageMeta } from '../seo/usePageMeta';
import { forgetPendingTemplate, pendingTemplate } from '../templates/pendingTemplate';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { IdeaBoard } from './IdeaBoard';
import { IdeaCalendar } from './IdeaCalendar';
import { IdeaTimeline } from './IdeaTimeline';
import { NewIdeaForm } from './NewIdeaForm';
import { WelcomePage } from './WelcomePage';

export function IdeasPage() {
  usePageMeta('Ideas', { index: false });
  const { current, isLoading, error } = useWorkspace();
  const location = useLocation();

  if (isLoading) {
    return <Skeleton variant="cards" />;
  }

  if (!current) {
    return error ? <ErrorMessage error={error} /> : <WelcomePage />;
  }

  // A template chosen before signing up opens in the New idea form as soon as there is a workspace to add it to.
  const waiting = pendingTemplate();
  if (waiting && !location.state) {
    return <Navigate to="/ideas" replace state={{ adding: true, template: waiting.slug }} />;
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
  const [view, setView] = useState<'list' | 'board' | 'calendar' | 'timeline' | 'matrix'>('list');
  const location = useLocation();
  const navigate = useNavigate();
  const request = location.state as { adding?: boolean; template?: string } | null;
  const openForm = request?.adding === true;
  const requested = { title: '', description: '', template: request?.template };
  const [adding, setAdding] = useState<{ title: string; description: string; template?: string } | null>(openForm ? requested : null);
  const [handledRequest, setHandledRequest] = useState(openForm ? location.key : null);
  // Asked for again while the page is open, by the command palette, the N shortcut, or a template: opens the form,
  // keeping a draft already in it unless a template was chosen.
  if (openForm && handledRequest !== location.key) {
    setHandledRequest(location.key);
    setAdding((open) => (requested.template ? requested : (open ?? requested)));
  }

  // Opened by "New idea" elsewhere: forget the request, so going back or reloading does not open the form again.
  useEffect(() => {
    if (openForm) {
      forgetPendingTemplate();
      void navigate('.', { replace: true, state: null });
    }
  }, [openForm, navigate]);
  const [brainstorming, setBrainstorming] = useState(false);
  const debouncedSearch = useDebounced(search, 250);
  const archived = tab === 'Archived';
  // The board shows every status in its own column, so it ignores the status tabs.
  const status = tab === 'All' || archived || view === 'board' ? undefined : tab;
  const ideas = useIdeas(workspace.id, { status, search: debouncedSearch, tag: tag || undefined, sort, archived });
  const tags = useTags(workspace.id);
  const ai = useAiStatus(workspace.id);
  const filtered = status !== undefined || debouncedSearch.trim() !== '' || tag !== '';
  const panel = useIdeaPanel();

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
          key={`${adding.template ?? ''}:${adding.title}`}
          workspaceId={workspace.id}
          initial={adding}
          template={adding.template}
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
        <FilterTab label="All" active={tab === 'All' || (view === 'board' && !archived)} onClick={() => setTab('All')} />
        {view !== 'board' &&
          statuses.map((s) => <FilterTab key={s} label={statusLabels[s]} active={tab === s} onClick={() => setTab(s)} />)}
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
          <FilterTab label="Board" active={view === 'board'} onClick={() => setView('board')} />
          <FilterTab label="Calendar" active={view === 'calendar'} onClick={() => setView('calendar')} />
          <FilterTab label="Timeline" active={view === 'timeline'} onClick={() => setView('timeline')} />
          <FilterTab label="Matrix" active={view === 'matrix'} onClick={() => setView('matrix')} />
        </div>
      </div>

      {ideas.isLoading && <Skeleton variant="cards" />}
      <ErrorMessage error={ideas.error} />
      {ideas.data &&
        (view === 'calendar' ? (
          <IdeaCalendar ideas={ideas.data} />
        ) : view === 'board' ? (
          <IdeaBoard ideas={ideas.data} />
        ) : view === 'timeline' ? (
          <IdeaTimeline ideas={ideas.data} />
        ) : view === 'matrix' ? (
          <IdeaMatrix ideas={ideas.data} />
        ) : (
          <IdeaList
            ideas={ideas.data}
            filtered={filtered}
            archived={archived}
            onAdd={() => setAdding({ title: '', description: '' })}
            onClearFilters={() => {
              setTab('All');
              setSearch('');
              setTag('');
            }}
          />
        ))}
      {panel.openId && <IdeaPanel key={panel.openId} id={panel.openId} onClose={panel.close} />}
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

interface IdeaListProps {
  ideas: Idea[];
  filtered: boolean;
  archived: boolean;
  onAdd: () => void;
  onClearFilters: () => void;
}

function IdeaList({ ideas, filtered, archived, onAdd, onClearFilters }: IdeaListProps) {
  const { linkProps } = useIdeaPanel();
  if (ideas.length === 0) {
    return (
      <div className="card empty stack center">
        <span className="feature-icon big" aria-hidden="true">
          {filtered ? <SearchX size={32} /> : archived ? <Archive size={32} /> : <Lightbulb size={32} />}
        </span>
        <p>
          {filtered
            ? 'No ideas match these filters.'
            : archived
              ? 'Nothing archived. Archive an idea you’ve set aside to keep it out of the list without deleting it.'
              : 'No ideas yet. Add your first one and give it a date to make it real by.'}
        </p>
        {filtered ? (
          <button type="button" className="button" onClick={onClearFilters}>
            Clear filters
          </button>
        ) : (
          !archived && (
            <button type="button" className="button primary" onClick={onAdd}>
              <Plus aria-hidden="true" size={18} /> Add your first idea
            </button>
          )
        )}
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
          <li key={idea.id} className="idea-item">
            <Link {...linkProps(idea.id)} className={idea.isOverdue ? 'card idea-card is-overdue' : 'card idea-card'}>
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
            {/* Outside the link, which can't hold a button; placed over the card's corner. */}
            <div className="idea-item-vote">
              <VoteButton idea={idea} />
            </div>
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
