import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowRightLeft, Bell, Building2, History, Home, Lightbulb, Plus, Settings, Users } from 'lucide-react';
import { useNavigate } from 'react-router';

import { formatDate } from '../api/dates';
import { useIdeas } from '../api/queries';
import type { Idea } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';
import { canManageWorkspace, useWorkspace } from '../workspaces/WorkspaceContext';
import { Dialog } from './Dialog';
import { readRecentIdeas } from './recentIdeas';

interface Entry {
  id: string;
  group: (typeof groups)[number];
  label: string;
  icon: ReactNode;
  detail?: ReactNode;
  run: () => void;
}

const groups = ['Recent ideas', 'Ideas', 'Actions'] as const;

/** How many matching ideas the palette lists. */
const maxIdeas = 6;

/** How many recently opened ideas the palette lists before anything is typed. */
const maxRecent = 5;

/**
 * How well an idea's title answers the search, best first: the whole title, its start, a word's start, anywhere in it,
 * and last a match in the description alone.
 */
function rank(idea: Idea, needle: string) {
  const title = idea.title.toLowerCase();
  if (title === needle) {
    return 0;
  }
  if (title.startsWith(needle)) {
    return 1;
  }
  let at = title.indexOf(needle);
  if (at < 0) {
    return 4;
  }
  for (; at >= 0; at = title.indexOf(needle, at + 1)) {
    if (!/[\p{L}\p{N}]/u.test(title[at - 1]!)) {
      return 2;
    }
  }
  return 3;
}

/**
 * Finds ideas in the current workspace by title or description and runs common actions, all from the keyboard: type to
 * filter, ↑ and ↓ to choose, Enter to go.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  // Read when the palette closes: whether focus goes back where it was, or stays with the page an action opened.
  const [focus] = useState(() => ({ restore: true }));
  const [active, setActive] = useState(0);
  const titleId = useId();
  const listId = useId();
  const navigate = useNavigate();
  const { all, current, select } = useWorkspace();
  // Read once, on opening: the ideas opened lately in this workspace.
  const [recent] = useState(() => readRecentIdeas());
  const search = useDebounced(query.trim(), 150);
  const ideas = useIdeas(current?.id ?? '', { search: search || undefined }, current !== null && search !== '');

  const go = (to: string, state?: unknown) => () => {
    focus.restore = false;
    onClose();
    void navigate(to, { state });
  };

  const actions: Entry[] = [
    ...(current
      ? [
          { id: 'new-idea', group: 'Actions' as const, label: 'New idea', icon: <Plus size={16} />, run: go('/ideas', { adding: true }) },
          { id: 'ideas', group: 'Actions' as const, label: 'Go to Ideas', icon: <Lightbulb size={16} />, run: go('/ideas') },
          { id: 'people', group: 'Actions' as const, label: 'Go to People', icon: <Users size={16} />, run: go('/people') },
        ]
      : []),
    ...(current && canManageWorkspace(current)
      ? [{ id: 'workspace-settings', group: 'Actions' as const, label: 'Go to Workspace settings', icon: <Building2 size={16} />, run: go('/workspace/settings') }]
      : []),
    { id: 'home', group: 'Actions', label: 'Go to Home', icon: <Home size={16} />, run: go('/') },
    { id: 'notifications', group: 'Actions', label: 'Go to Notifications', icon: <Bell size={16} />, run: go('/notifications') },
    { id: 'settings', group: 'Actions', label: 'Go to Settings', icon: <Settings size={16} />, run: go('/settings') },
    ...all
      .filter((w) => w.id !== current?.id)
      .map((w) => ({
        id: `workspace-${w.id}`,
        group: 'Actions' as const,
        label: `Switch to ${w.name}`,
        icon: <ArrowRightLeft size={16} />,
        run: () => {
          select(w.id);
          go('/ideas')();
        },
      })),
  ];

  const needle = query.trim().toLowerCase();
  // Lists ideas only once they answer what is typed now, so Enter can't open one found for earlier text.
  const ideasCurrent = search !== '' && search === query.trim() && !ideas.isPlaceholderData;
  const searching = query.trim() !== '' && current !== null && !ideasCurrent;
  const entries: Entry[] = [
    ...(needle === '' && current
      ? recent
          .filter((r) => r.workspaceId === current.id)
          .slice(0, maxRecent)
          .map((r) => ({
            id: `recent-${r.id}`,
            group: 'Recent ideas' as const,
            label: r.title,
            icon: <History size={16} />,
            run: go(`/ideas/${r.id}`),
          }))
      : []),
    ...(ideasCurrent
      ? (ideas.data ?? [])
          // Sorting is stable, so ideas that rank alike keep the API's order.
          .map((idea) => ({ idea, rank: rank(idea, needle) }))
          .sort((a, b) => a.rank - b.rank)
          .slice(0, maxIdeas)
          .map(({ idea }) => ({
            id: `idea-${idea.id}`,
            group: 'Ideas' as const,
            label: idea.title,
            icon: <Lightbulb size={16} />,
            detail: (
              <>
                <StatusBadge idea={idea} /> <span className="muted small">{formatDate(idea.targetDate)}</span>
              </>
            ),
            run: go(`/ideas/${idea.id}`),
          }))
      : []),
    ...actions.filter((a) => a.label.toLowerCase().includes(needle)),
  ];
  const selected = Math.min(active, Math.max(entries.length - 1, 0));
  const optionId = (entry: Entry) => `${listId}-${entry.id}`;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (entries.length > 0) {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive((selected + step + entries.length) % entries.length);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      entries[selected]?.run();
    }
  };

  // Keeps the chosen entry in view as the arrow keys move through a long list.
  const activeId = entries[selected] ? optionId(entries[selected]) : undefined;
  useEffect(() => {
    if (activeId) {
      document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeId]);

  return (
    <Dialog labelledBy={titleId} focus={focus} className="palette" onClose={onClose}>
      <h2 id={titleId} className="visually-hidden">
        Search and commands
      </h2>
      <input
        data-autofocus
        className="palette-input"
        role="combobox"
        aria-expanded={entries.length > 0}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        aria-label="Search ideas or type a command"
        placeholder={current ? `Search ideas in ${current.name}, or type a command…` : 'Type a command…'}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      <div id={listId} className="palette-list" role="listbox" aria-label="Results">
        {groups.map((group) => {
          const members = entries.filter((e) => e.group === group);
          return (
            members.length > 0 && (
              <div key={group} role="group" aria-label={group}>
                <p className="palette-group muted small" aria-hidden="true">
                  {group}
                </p>
                {members.map((entry) => {
                  const index = entries.indexOf(entry);
                  return (
                    <div
                      key={entry.id}
                      id={optionId(entry)}
                      role="option"
                      aria-selected={index === selected}
                      className={index === selected ? 'palette-option active' : 'palette-option'}
                      onMouseMove={() => setActive(index)}
                      onClick={entry.run}
                    >
                      <span className="palette-icon" aria-hidden="true">
                        {entry.icon}
                      </span>
                      <span className="grow">{entry.label}</span>
                      {entry.detail}
                    </div>
                  );
                })}
              </div>
            )
          );
        })}
      </div>
      <p className="muted small palette-empty" role="status">
        {searching ? 'Searching…' : entries.length === 0 ? 'Nothing matches.' : query.trim() ? `${entries.length} ${entries.length === 1 ? 'result' : 'results'}` : ''}
      </p>
      <p className="muted small palette-hint" aria-hidden="true">
        ↑↓ to choose · Enter to open · Esc to close
      </p>
    </Dialog>
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
