import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Archive, CalendarDays, ChartGantt, Grid2x2, Lightbulb, List, Plus, SearchX, SlidersHorizontal, SquareKanban } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';

import { daysUntil, describeDue, formatDate } from '../api/dates';
import { UnavailableAiButton } from '../ai/AiAllowance';
import { BrainstormPanel, describeBrainstormed } from '../ai/BrainstormPanel';
import { useAiStatus, useIdeas, useTags } from '../api/queries';
import { personLabel, sortLabels, statuses, statusLabels, type Idea, type IdeaSort, type IdeaStatus, type Workspace } from '../api/types';
import { Field } from '../components/Field';
import { LoadError } from '../components/ErrorMessage';
import { Progress } from '../components/Progress';
import { Skeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { Tags } from '../components/Tags';
import { useEdgeFade } from '../components/useEdgeFade';
import { useNarrowScreen } from '../components/useNarrowScreen';
import { IdeaPanel } from '../panel/IdeaPanel';
import { useIdeaPanel } from '../panel/useIdeaPanel';
import { IdeaMatrix } from '../priority/IdeaMatrix';
import { VoteButton } from '../priority/VoteButton';
import { usePageMeta } from '../seo/usePageMeta';
import { forgetPendingTemplate, pendingTemplate } from '../templates/pendingTemplate';
import { StarterTemplates } from '../templates/StarterTemplates';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { BulkBar, selectable, useBulkSelection } from './BulkActions';
import { IdeaBoard } from './IdeaBoard';
import { IdeaCalendar } from './IdeaCalendar';
import { IdeaTimeline } from './IdeaTimeline';
import { NewIdeaForm } from './NewIdeaForm';
import { WelcomePage } from './WelcomePage';

export function IdeasPage() {
  usePageMeta('Ideas', { index: false });
  const workspaces = useWorkspace();
  const { current, isLoading, error } = workspaces;
  const location = useLocation();
  // A workspace just created here moves on to its invite step; showing its ideas, or a waiting template, first would
  // take the user past that step.
  const [created, setCreated] = useState(false);

  if (isLoading || created) {
    return <Skeleton variant="cards" />;
  }

  if (!current) {
    return error ? <LoadError queries={workspaces} /> : <WelcomePage onCreated={() => setCreated(true)} />;
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

const views = ['list', 'board', 'calendar', 'timeline', 'matrix'] as const;
type View = (typeof views)[number];
const viewLabels: Record<View, string> = { list: 'List', board: 'Board', calendar: 'Calendar', timeline: 'Timeline', matrix: 'Matrix' };
const viewIcons: Record<View, ReactNode> = {
  list: <List aria-hidden="true" size={18} />,
  board: <SquareKanban aria-hidden="true" size={18} />,
  calendar: <CalendarDays aria-hidden="true" size={18} />,
  timeline: <ChartGantt aria-hidden="true" size={18} />,
  matrix: <Grid2x2 aria-hidden="true" size={18} />,
};
const tabs: readonly Tab[] = ['All', ...statuses, 'Archived'];

function WorkspaceIdeas({ workspace }: { workspace: Workspace }) {
  const location = useLocation();
  const navigate = useNavigate();
  const request = location.state as { adding?: boolean; template?: string } | null;
  const openForm = request?.adding === true;
  const { choices, choose, search, setSearch, debouncedSearch } = useListChoices(workspace.id, openForm);
  const { tab, tag, sort, view, density } = choices;
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
  const archived = tab === 'Archived';
  // The board shows every status in its own column, so it ignores the status tabs.
  const status = tab === 'All' || archived || view === 'board' ? undefined : tab;
  const ideas = useIdeas(workspace.id, { status, search: debouncedSearch, tag: tag || undefined, sort, archived });
  const tags = useTags(workspace.id);
  const ai = useAiStatus(workspace.id);
  const filtered = status !== undefined || debouncedSearch.trim() !== '' || tag !== '';
  // A workspace with no ideas yet has nothing to filter, sort, or lay out, so it shows only the way to add one. One
  // whose ideas are all archived keeps the controls, so the Archived tab can still be reached.
  const nothingActive = ideas.data?.length === 0 && !filtered && !archived;
  const archive = useIdeas(workspace.id, { archived: true }, nothingActive);
  const noIdeas = nothingActive && !archive.data?.length;
  const panel = useIdeaPanel();
  const statusTabs = useEdgeFade<HTMLElement>();
  const viewTabs = useEdgeFade<HTMLDivElement>();
  const narrow = useNarrowScreen();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersToggle = useRef<HTMLButtonElement>(null);
  const closeFilters = () => {
    setFiltersOpen(false);
    filtersToggle.current?.focus();
  };
  // What the Filters button counts on a phone: the status tab and the tag; the search box stays beside it, in view.
  const activeFilters = (tab === 'All' || (view === 'board' && !archived) ? 0 : 1) + (tag === '' ? 0 : 1);

  const statusFilter = (
    <>
      <FilterTab label="All" active={tab === 'All' || (view === 'board' && !archived)} onClick={() => choose({ tab: 'All' })} />
      {view !== 'board' && statuses.map((s) => <FilterTab key={s} label={statusLabels[s]} active={tab === s} onClick={() => choose({ tab: s })} />)}
      <FilterTab label="Archived" active={archived} onClick={() => choose({ tab: 'Archived' })} />
    </>
  );
  const searchField = (
    <Field label="Search">
      {(props) => <input {...props} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title or description" />}
    </Field>
  );
  const tagField = tags.data && tags.data.length > 0 && (
    <Field label="Tag">
      {(props) => (
        <select {...props} value={tag} onChange={(e) => choose({ tag: e.target.value })}>
          <option value="">All tags</option>
          {tags.data.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
  const sortField = (
    <Field label="Sort by">
      {(props) => (
        <select {...props} value={sort} onChange={(e) => choose({ sort: e.target.value as IdeaSort })}>
          {(Object.keys(sortLabels) as IdeaSort[]).map((s) => (
            <option key={s} value={s}>
              {sortLabels[s]}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
  // On a phone the views are icons, named for screen readers and in a tooltip, so all five fit on one row.
  const viewChoice = (icons = false) =>
    views.map((v) => (
      <FilterTab key={v} label={viewLabels[v]} icon={icons ? viewIcons[v] : undefined} active={view === v} onClick={() => choose({ view: v })} />
    ));
  const densityChoice = view === 'list' && (
    <div className="tabs" role="group" aria-label="Density">
      {densities.map((d) => (
        <FilterTab key={d} label={densityLabels[d]} active={density === d} onClick={() => choose({ density: d })} />
      ))}
    </div>
  );

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
            {ai.data?.enabled === false && <UnavailableAiButton label="Brainstorm with AI" compact />}
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

      {!noIdeas && !narrow && (
        <>
          <nav ref={statusTabs} className="tabs" aria-label="Filter by status">
            {statusFilter}
          </nav>

          <div className="row wrap end toolbar">
            {searchField}
            {tagField}
            {sortField}
            <div ref={viewTabs} className="tabs" role="group" aria-label="View">
              {viewChoice()}
            </div>
            {densityChoice}
          </div>
        </>
      )}

      {/* On a phone the filters would push the ideas a screen down, so they wait behind a Filters button. */}
      {!noIdeas && narrow && (
        <>
          <div className="row end phone-filters">
            {searchField}
            <button
              ref={filtersToggle}
              type="button"
              className="button filters-toggle"
              aria-expanded={filtersOpen}
              aria-controls="idea-filters"
              aria-label={activeFilters > 0 ? `Filters, ${activeFilters} active` : 'Filters'}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal aria-hidden="true" size={18} /> Filters
              {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
            </button>
          </div>
          {filtersOpen && (
            <section
              id="idea-filters"
              className="card stack filter-sheet"
              aria-label="Filters"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  closeFilters();
                }
              }}
            >
              <nav className="tabs wrap-tabs" aria-label="Filter by status">
                {statusFilter}
              </nav>
              {tagField}
              {sortField}
              {densityChoice}
              {/* Not "Done", which is a status above. */}
              <button type="button" className="button" onClick={closeFilters}>
                Close filters
              </button>
            </section>
          )}
          <div className="tabs view-icons" role="group" aria-label="View">
            {viewChoice(true)}
          </div>
        </>
      )}

      {ideas.isLoading && <Skeleton variant={view === 'list' ? 'cards' : view} />}
      <LoadError queries={ideas} />
      {ideas.data &&
        (noIdeas ? (
          !adding && <FirstIdea onAdd={() => setAdding({ title: '', description: '' })} />
        ) : view === 'calendar' ? (
          <IdeaCalendar ideas={ideas.data} />
        ) : view === 'board' ? (
          <IdeaBoard ideas={ideas.data} />
        ) : view === 'timeline' ? (
          <IdeaTimeline ideas={ideas.data} />
        ) : view === 'matrix' ? (
          <IdeaMatrix ideas={ideas.data} />
        ) : (
          <IdeaList
            workspaceId={workspace.id}
            ideas={ideas.data}
            filtered={filtered}
            archived={archived}
            compact={density === 'compact'}
            onClearFilters={() => {
              choose({ tab: 'All', tag: '' });
              setSearch('');
            }}
          />
        ))}
      {panel.openId && <IdeaPanel key={panel.openId} id={panel.openId} onClose={panel.close} />}
    </div>
  );
}

/** How much room each idea takes on the List view: a card, or a single row with its details in columns. */
const densities = ['comfortable', 'compact'] as const;
type Density = (typeof densities)[number];
const densityLabels: Record<Density, string> = { comfortable: 'Comfortable', compact: 'Compact' };

/** The list's choices, kept per workspace in the browser. All but the density also live in the address. */
interface Choices {
  tab: Tab;
  tag: string;
  sort: IdeaSort;
  view: View;
  density: Density;
}

const defaultChoices: Choices = { tab: 'All', tag: '', sort: 'TargetDate', view: 'list', density: 'comfortable' };
const validChoice: { [K in keyof Choices]: (value: unknown) => boolean } = {
  tab: (value) => tabs.includes(value as Tab),
  tag: (value) => typeof value === 'string',
  sort: (value) => typeof value === 'string' && Object.hasOwn(sortLabels, value),
  view: (value) => views.includes(value as View),
  density: (value) => densities.includes(value as Density),
};
/** The address parameter of each choice that can be shared, as in `/ideas?status=Done&tag=launch&q=spring&sort=Votes&view=board`. */
const choiceParams = { tab: 'status', tag: 'tag', sort: 'sort', view: 'view' } as const satisfies Partial<Record<keyof Choices, string>>;
const searchParam = 'q';

/**
 * The ideas list's view, status tab, tag, order, and density, and its search. Each choice is remembered in the browser
 * per workspace, so a reload or a later visit opens the list as it was left (storage may be unavailable, as in a private
 * window; the list then starts fresh), and all but the density are kept in the address too, so a filtered list can be
 * shared or bookmarked. A choice in the address, as from a shared link or a tag chip's `?tag=`, wins over the remembered
 * one without replacing it. Changes replace the address rather than adding to the history, and leave its other
 * parameters, such as the side panel's `?idea=`, alone, and the page scrolled where it was.
 */
function useListChoices(workspaceId: string, paused: boolean) {
  const key = `ideaverse.ideas.${workspaceId}`;
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [saved, setSaved] = useState<Choices>(() => {
    const stored = readChoices(key);
    const valid = (name: keyof Choices) => stored[name] !== undefined && validChoice[name](stored[name]);
    return {
      tab: valid('tab') ? (stored.tab as Tab) : defaultChoices.tab,
      tag: valid('tag') ? (stored.tag as string) : defaultChoices.tag,
      sort: valid('sort') ? (stored.sort as IdeaSort) : defaultChoices.sort,
      view: valid('view') ? (stored.view as View) : defaultChoices.view,
      density: valid('density') ? (stored.density as Density) : defaultChoices.density,
    };
  });
  const linked = (name: keyof typeof choiceParams) => {
    const value = params.get(choiceParams[name]);
    return value !== null && validChoice[name](value) ? value : undefined;
  };
  const choices: Choices = {
    tab: (linked('tab') as Tab | undefined) ?? saved.tab,
    tag: linked('tag') ?? saved.tag,
    sort: (linked('sort') as IdeaSort | undefined) ?? saved.sort,
    view: (linked('view') as View | undefined) ?? saved.view,
    density: saved.density,
  };
  const [search, setSearch] = useState(() => params.get(searchParam) ?? '');
  const debouncedSearch = useDebounced(search, 250);

  // The address shows every choice that differs from the default, including remembered ones it arrived without.
  const address = (next: Choices, query: string) => {
    const result = new URLSearchParams(params);
    for (const [name, param] of Object.entries(choiceParams) as [keyof typeof choiceParams, string][]) {
      if (next[name] === defaultChoices[name]) {
        result.delete(param);
      } else {
        result.set(param, next[name]);
      }
    }
    if (query.trim() === '') {
      result.delete(searchParam);
    } else {
      result.set(searchParam, query);
    }
    return result.toString();
  };
  const wanted = address(choices, debouncedSearch);
  const current = params.toString();
  useEffect(() => {
    // While "New idea" from elsewhere clears its request from the address, which this would put back.
    if (!paused && wanted !== current) {
      setParams(new URLSearchParams(wanted), { replace: true, state: location.state, preventScrollReset: true });
    }
  }, [paused, wanted, current, setParams, location.state]);

  const choose = (changes: Partial<Choices>) => {
    setSaved((previous) => ({ ...previous, ...changes }));
    try {
      localStorage.setItem(key, JSON.stringify({ ...readChoices(key), ...changes }));
    } catch {
      // Not remembered this time; the choice still applies.
    }
    // All at once: changes made one after another in the same event would each start from the same address.
    setParams(new URLSearchParams(address({ ...choices, ...changes }, debouncedSearch)), { replace: true, state: location.state, preventScrollReset: true });
  };

  return { choices, choose, search, setSearch, debouncedSearch };
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

function FilterTab({ label, icon, active, onClick }: { label: string; icon?: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`${active ? 'tab active' : 'tab'}${icon ? ' icon-tab' : ''}`}
      aria-pressed={active}
      aria-label={icon ? label : undefined}
      title={icon ? label : undefined}
      onClick={onClick}
    >
      {icon ?? label}
    </button>
  );
}

/** The ideas page of a workspace with no ideas yet: a blank idea, or a start from a template. */
function FirstIdea({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card empty stack center">
      <span className="feature-icon big" aria-hidden="true">
        <Lightbulb size={32} />
      </span>
      <p>No ideas yet. Add your first one and give it a date to make it real by, or start from a template with its checklist ready.</p>
      <div className="row wrap center-row">
        {/* A plain button: "New idea" above stays the page's one primary action. */}
        <button type="button" className="button" onClick={onAdd}>
          <Plus aria-hidden="true" size={18} /> Add a blank idea
        </button>
        <StarterTemplates />
      </div>
    </div>
  );
}

interface IdeaListProps {
  workspaceId: string;
  ideas: Idea[];
  filtered: boolean;
  archived: boolean;
  compact: boolean;
  onClearFilters: () => void;
}

function IdeaList({ workspaceId, ideas, filtered, archived, compact, onClearFilters }: IdeaListProps) {
  const { linkProps } = useIdeaPanel();
  const selection = useBulkSelection(ideas);
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
              : 'No active ideas. Add one with New idea, or find earlier ones under Archived.'}
        </p>
        {filtered && (
          <button type="button" className="button" onClick={onClearFilters}>
            Clear filters
          </button>
        )}
      </div>
    );
  }

  const overdue = ideas.filter((i) => i.isOverdue).length;
  const dueSoon = archived ? 0 : ideas.filter((i) => i.status !== 'Done' && !i.isOverdue && daysUntil(i.targetDate) <= 7).length;
  // Ideas the user can change get a checkbox beside them, for changing several at once; the others keep the space, so rows line up.
  const choosable = ideas.filter(selectable);
  const allChosen = choosable.length > 0 && selection.selected.length === choosable.length;

  return (
    <>
      {(overdue > 0 || dueSoon > 0) && (
        <p className="summary" role="status">
          {overdue > 0 && <span className="overdue-text">{overdue} overdue</span>}
          {overdue > 0 && dueSoon > 0 && ' · '}
          {dueSoon > 0 && <span>{dueSoon} due within a week</span>}
        </p>
      )}
      {choosable.length > 0 && (
        <label className="select-all">
          <input
            type="checkbox"
            checked={allChosen}
            ref={(input) => {
              if (input) {
                input.indeterminate = selection.selected.length > 0 && !allChosen;
              }
            }}
            onChange={() => (allChosen ? selection.clear() : selection.selectAll(choosable))}
          />
          Select all
        </label>
      )}
      <ul className={['idea-list', compact && 'compact', choosable.length > 0 && 'selectable'].filter(Boolean).join(' ')}>
        {ideas.map((idea) => (
          <li key={idea.id} className="idea-item">
            {choosable.length > 0 &&
              (selectable(idea) ? (
                <input
                  type="checkbox"
                  className="idea-select"
                  aria-label={`Select ${idea.title}`}
                  checked={selection.isSelected(idea.id)}
                  onChange={() => selection.toggle(idea.id)}
                />
              ) : (
                <span className="idea-select" aria-hidden="true" />
              ))}
            {/* The title link is stretched over the card, so a click anywhere opens the idea while its tags stay links of their own. */}
            {compact ? (
              <div className={cardClass(idea, 'card idea-card idea-row')}>
                <div className="idea-row-main">
                  <h2 className="idea-title">
                    <Link {...linkProps(idea.id)} className="stretched-link">
                      {idea.title}
                    </Link>
                  </h2>
                  <Tags tags={idea.tags} />
                </div>
                <StatusBadge idea={idea} />
                {/* Separate columns on a wide screen; one wrapped line under the title on a narrower one. */}
                <div className="idea-row-details small">
                  <span className={idea.isOverdue ? 'overdue-text' : undefined}>{formatDate(idea.targetDate)}</span>
                  <span className="muted">{describeTeam(idea)}</span>
                  {/* Shorter than the card's "No components yet", to fit its column on one line. */}
                  {idea.componentCount === 0 ? (
                    <span className="muted">No components</span>
                  ) : (
                    <Progress done={idea.completedComponentCount} total={idea.componentCount} />
                  )}
                </div>
              </div>
            ) : (
              <div className={cardClass(idea, 'card idea-card')}>
                <div className="row spread">
                  <h2 className="idea-title">
                    <Link {...linkProps(idea.id)} className="stretched-link">
                      {idea.title}
                    </Link>
                  </h2>
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
              </div>
            )}
            {/* Placed over the card's corner, above its stretched link. */}
            <div className="idea-item-vote">
              <VoteButton idea={idea} />
            </div>
          </li>
        ))}
      </ul>
      {(selection.selected.length > 0 || selection.problems.length > 0) && <BulkBar workspaceId={workspaceId} selection={selection} />}
    </>
  );
}

/** A list card's classes: overdue ideas are marked, and finished ones step back. */
function cardClass(idea: Idea, base: string): string {
  return `${base}${idea.isOverdue ? ' is-overdue' : ''}${idea.status === 'Done' ? ' is-done' : ''}`;
}

/** Who the idea belongs to, from the user's point of view. */
function describeTeam(idea: Idea): string {
  if (idea.role === 'Owner') {
    return idea.memberCount === 0 ? 'Only you' : `You + ${idea.memberCount}`;
  }
  const owner = personLabel(idea.ownerName, idea.ownerEmail);
  return idea.role === 'Member' ? `You’re on ${owner}’s team` : `By ${owner}`;
}

function readChoices(key: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
