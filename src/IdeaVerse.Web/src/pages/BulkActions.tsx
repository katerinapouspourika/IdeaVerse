import { useEffect, useId, useRef, useState } from 'react';

import { formatDate, todayIso } from '../api/dates';
import { useBulkIdeas, useTags } from '../api/queries';
import { statuses, statusLabels, type BulkIdeaRequest, type BulkIdeaResult, type Idea, type IdeaStatus } from '../api/types';
import { useToast } from '../components/Feedback';

/** "1 idea", "3 ideas". */
function countIdeas(count: number): string {
  return count === 1 ? '1 idea' : `${count} ideas`;
}

/** A tag as the API stores it: trimmed, single-spaced, lower case. */
function normalizeTag(tag: string): string {
  return tag.trim().split(/\s+/).join(' ').toLowerCase();
}

/** An idea the bulk change could not apply to, and why. */
interface Problem {
  id: string;
  title: string;
  message: string;
}

/**
 * The ideas picked on the List view, and the bulk changes made to them. It lives with the list rather than the action bar,
 * which leaves once nothing is selected, so an Undo offered after the change still works.
 */
export function useBulkSelection(ideas: Idea[]) {
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [problems, setProblems] = useState<Problem[]>([]);
  const bulk = useBulkIdeas();
  const toast = useToast();
  // Only ideas the user can change now are picked, so one that became read-only, or left the list, drops out.
  const selected = ideas.filter((idea) => chosen.has(idea.id) && selectable(idea));

  const replace = (next: ReadonlySet<string>) => {
    setChosen(next);
    setProblems([]);
  };
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (!next.delete(id)) {
      next.add(id);
    }
    replace(next);
  };

  /**
   * Applies a change to `targets`, confirming it in a toast (`done` describes it, given how many ideas it made a difference to
   * and how many were already as asked) with an Undo when `undo` can put those ideas back. `differs` tells, from an idea as
   * it was, whether the change makes a difference to it, as adding a tag it already has does not. Ideas it could not change
   * stay selected, with the reasons shown in the bar.
   */
  const apply = (
    change: Omit<BulkIdeaRequest, 'ids'>,
    targets: Idea[],
    done: (count: number, already: number) => string,
    undo?: (before: Idea[]) => void,
    differs: (idea: Idea) => boolean = () => true,
  ) => {
    bulk.mutate(
      { ...change, ids: targets.map((idea) => idea.id) },
      {
        onSuccess: (results) => {
          const changed = new Set(results.filter((r) => r.outcome === 'Changed').map((r) => r.id));
          const failed = results.filter((r) => r.outcome !== 'Changed');
          const before = targets.filter((idea) => changed.has(idea.id) && differs(idea));
          const message = done(before.length, changed.size - before.length);
          setChosen((current) => new Set([...current].filter((id) => !changed.has(id))));
          setProblems(failed.map((r) => ({ id: r.id, title: targets.find((idea) => idea.id === r.id)?.title ?? 'An idea', message: r.message ?? 'It couldn’t be changed.' })));
          toast({
            message: failed.length === 0 ? message : `${message}. ${countIdeas(failed.length)} couldn’t be changed.`,
            tone: failed.length > 0 ? 'error' : undefined,
            undo: undo && before.length > 0 ? () => undo(before) : undefined,
          });
        },
        onError: (error) => toast({ message: error.message, tone: 'error' }),
      },
    );
  };

  /** Puts ideas back with one or more bulk changes, saying so only when that fails. */
  const revert = (changes: Omit<BulkIdeaRequest, 'ids'>[], ids: string[][]) => {
    Promise.all(changes.map((change, i) => bulk.mutateAsync({ ...change, ids: ids[i]! })))
      .then((all) => {
        const failed = all.flat().filter((r: BulkIdeaResult) => r.outcome !== 'Changed').length;
        if (failed > 0) {
          toast({ message: `Couldn’t undo the change to ${countIdeas(failed)}.`, tone: 'error' });
        }
      })
      .catch((error: Error) => toast({ message: error.message, tone: 'error' }));
  };

  const setStatus = (status: IdeaStatus) =>
    apply({ operation: 'SetStatus', status }, selected, (n) => `Set ${countIdeas(n)} to ${statusLabels[status]}`, (before) => {
      const previous = [...new Set(before.map((idea) => idea.status))];
      revert(
        previous.map((s) => ({ operation: 'SetStatus', status: s })),
        previous.map((s) => before.filter((idea) => idea.status === s).map((idea) => idea.id)),
      );
    });

  // Counted, and undone, only where the tag was added or removed: not where the idea already had it, or never did.
  const addTag = (tag: string) => {
    const name = normalizeTag(tag);
    apply(
      { operation: 'AddTag', tag: name },
      selected,
      (n, already) => (n > 0 || already === 0 ? `Tagged ${countIdeas(n)} “${name}”` : already === 1 ? `The idea already had “${name}”` : `All ${already} ideas already had “${name}”`),
      (added) => revert([{ operation: 'RemoveTag', tag: name }], [added.map((idea) => idea.id)]),
      (idea) => !idea.tags.includes(name),
    );
  };

  const removeTag = (tag: string) => {
    const name = normalizeTag(tag);
    apply(
      { operation: 'RemoveTag', tag: name },
      selected,
      (n, already) => (n > 0 || already === 0 ? `Removed “${name}” from ${countIdeas(n)}` : already === 1 ? `The idea didn’t have “${name}”` : `None of the ${already} ideas had “${name}”`),
      (removed) => revert([{ operation: 'AddTag', tag: name }], [removed.map((idea) => idea.id)]),
      (idea) => idea.tags.includes(name),
    );
  };

  // A move has no Undo: a postponed idea is put back one at a time, from its own page, within a few minutes.
  const moveTo = (targetDate: string) =>
    apply({ operation: 'MoveTargetDate', targetDate }, selected, (n) => `Moved ${countIdeas(n)} to ${formatDate(targetDate)}`);
  const moveWeekLater = () =>
    apply({ operation: 'MoveTargetDate', days: 7 }, selected.filter(postponable), (n) => `Postponed ${countIdeas(n)} by a week`);

  const archive = () =>
    apply({ operation: 'Archive' }, selected.filter(archivable), (n) => `Archived ${countIdeas(n)}`, (before) =>
      revert([{ operation: 'Restore' }], [before.map((idea) => idea.id)]),
    );

  return {
    selected,
    problems,
    pending: bulk.isPending,
    isSelected: (id: string) => chosen.has(id),
    toggle,
    selectAll: (all: Idea[]) => replace(new Set(all.map((idea) => idea.id))),
    clear: () => replace(new Set()),
    setStatus,
    addTag,
    removeTag,
    moveTo,
    moveWeekLater,
    archive,
  };
}

export type BulkSelection = ReturnType<typeof useBulkSelection>;

/** Whether the user can pick an idea for a bulk change: one they can edit, and not archived, as archived ideas are read-only. */
export function selectable(idea: Idea): boolean {
  return idea.canEdit && !idea.archivedAt;
}

/** Archiving is for an idea's owner and the workspace's admins, not its whole team. */
function archivable(idea: Idea): boolean {
  return idea.canManage;
}

/** A finished idea isn't postponed. */
function postponable(idea: Idea): boolean {
  return idea.status !== 'Done';
}

type Panel = 'tag' | 'date' | null;

/**
 * The bar of actions for the selected ideas, kept in view at the bottom of the screen while the list scrolls: how many
 * are selected, a status, a tag to add or remove, a new target date, archiving, and clearing the selection. It says up
 * front which selected ideas an action would skip, and after a change, which ideas it could not change and why.
 */
export function BulkBar({ workspaceId, selection }: { workspaceId: string; selection: BulkSelection }) {
  const { selected, problems, pending } = selection;
  const [panel, setPanel] = useState<Panel>(null);
  const [tag, setTag] = useState('');
  const [date, setDate] = useState('');
  const tags = useTags(workspaceId);
  const tagList = useId();
  const unarchivable = selected.filter((idea) => !archivable(idea)).length;
  const finished = selected.filter((idea) => !postponable(idea)).length;
  const toggle = (next: Panel) => setPanel(panel === next ? null : next);
  const bar = useRef<HTMLElement>(null);
  // Toasts at the bottom of the screen rise above the bar while it is there, rather than covering its actions.
  useEffect(() => {
    const element = bar.current;
    if (!element) {
      return;
    }
    const root = document.documentElement;
    const update = () => root.style.setProperty('--bulk-bar-height', `${element.offsetHeight}px`);
    update();
    root.classList.add('has-bulk-bar');
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    resize?.observe(element);
    return () => {
      resize?.disconnect();
      root.classList.remove('has-bulk-bar');
      root.style.removeProperty('--bulk-bar-height');
    };
  }, []);

  const submitTag = (add: boolean) => {
    if (tag.trim() !== '') {
      (add ? selection.addTag : selection.removeTag)(tag);
      setTag('');
      setPanel(null);
    }
  };

  return (
    <section ref={bar} className="card bulk-bar stack tight" aria-label="Bulk actions">
      <div className="row wrap bulk-row">
        <strong className="bulk-count" role="status">
          {selected.length} selected
        </strong>
        <select
          aria-label="Change status"
          value=""
          disabled={pending}
          onChange={(e) => {
            if (e.target.value) {
              selection.setStatus(e.target.value as IdeaStatus);
            }
          }}
        >
          <option value="" disabled>
            Change status…
          </option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
        <button type="button" className="button small" aria-expanded={panel === 'tag'} onClick={() => toggle('tag')}>
          Tag…
        </button>
        <button type="button" className="button small" aria-expanded={panel === 'date'} onClick={() => toggle('date')}>
          Target date…
        </button>
        <button
          type="button"
          className="button small"
          aria-disabled={pending || unarchivable === selected.length}
          onClick={() => {
            if (!pending && unarchivable < selected.length) {
              selection.archive();
            }
          }}
        >
          Archive
        </button>
        <button type="button" className="button small ghost" onClick={selection.clear}>
          Clear selection
        </button>
      </div>

      {panel === 'tag' && (
        <form
          className="row wrap bulk-row"
          aria-label="Tag the selected ideas"
          onSubmit={(e) => {
            e.preventDefault();
            submitTag(true);
          }}
        >
          <input aria-label="Tag" list={tagList} value={tag} maxLength={30} onChange={(e) => setTag(e.target.value)} placeholder="Tag name" />
          <datalist id={tagList}>{tags.data?.map((t) => <option key={t} value={t} />)}</datalist>
          <button type="submit" className="button small" disabled={pending}>
            Add tag
          </button>
          <button
            type="button"
            className="button small"
            disabled={pending}
            onClick={() => submitTag(false)}
          >
            Remove tag
          </button>
        </form>
      )}

      {panel === 'date' && (
        <form
          className="row wrap bulk-row"
          aria-label="Move the target date"
          onSubmit={(e) => {
            e.preventDefault();
            if (date) {
              selection.moveTo(date);
              setPanel(null);
            }
          }}
        >
          <input type="date" aria-label="New target date" min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="submit" className="button small" disabled={pending || !date}>
            Move
          </button>
          <button
            type="button"
            className="button small"
            aria-disabled={pending || finished === selected.length}
            onClick={() => {
              if (!pending && finished < selected.length) {
                selection.moveWeekLater();
                setPanel(null);
              }
            }}
          >
            +1 week
          </button>
        </form>
      )}

      {(unarchivable > 0 || (panel === 'date' && finished > 0)) && (
        <ul className="bulk-notes small muted">
          {unarchivable > 0 && (
            <li>
              {unarchivable === 1 ? '1 selected idea' : `${unarchivable} selected ideas`} can’t be archived: only an idea’s owner or a workspace
              admin can.
            </li>
          )}
          {panel === 'date' && finished > 0 && (
            <li>{finished === 1 ? '1 selected idea is done and isn’t' : `${finished} selected ideas are done and aren’t`} moved a week later.</li>
          )}
        </ul>
      )}

      {problems.length > 0 && (
        <div className="bulk-problems small" role="alert">
          <strong>Not changed:</strong>
          <ul>
            {problems.map((p) => (
              <li key={p.id}>
                “{p.title}”: {p.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
