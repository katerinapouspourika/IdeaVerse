import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BulkIdeaRequest, BulkIdeaResult, Idea } from '../api/types';
import { anIdea, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

const launch = anIdea({ id: 'a', title: 'Spring launch', status: 'InProgress', tags: ['q4'] });
const podcast = anIdea({ id: 'b', title: 'Podcast', status: 'Planned', role: 'Member', canManage: false });
const webinar = anIdea({ id: 'c', title: 'Webinar', status: 'Done' });
const watched = anIdea({ id: 'd', title: 'Rebrand', role: 'Viewer', canEdit: false, canManage: false });

/** Answers each bulk change by applying it to the ideas, or refusing those listed in `refuse`. */
function bulkRoute(ideas: Idea[], refuse: Record<string, string> = {}) {
  return (body: unknown) => {
    const change = body as BulkIdeaRequest;
    const results: BulkIdeaResult[] = change.ids.map((id) => {
      const idea = ideas.find((i) => i.id === id)!;
      return refuse[id]
        ? { id, outcome: 'Conflict', idea: null, message: refuse[id] }
        : { id, outcome: 'Changed', idea: { ...idea, status: change.status ?? idea.status }, message: null };
    });
    return { status: 200, body: results };
  };
}

function bulkCalls(calls: { method: string; path: string; body: unknown }[]) {
  return calls.filter((c) => c.method === 'POST' && c.path === '/api/v1/ideas/bulk').map((c) => c.body);
}

describe('Bulk actions on the ideas list', () => {
  it('offers a checkbox only for ideas the user can change, and selects all of those at once', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [launch, podcast, webinar, watched] } });
    renderApp('/ideas');

    await screen.findByText('Spring launch');
    expect(screen.getByRole('checkbox', { name: 'Select Spring launch' })).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Select Rebrand' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Podcast' }));
    const bar = screen.getByRole('region', { name: 'Bulk actions' });
    expect(within(bar).getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveProperty('indeterminate', true);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(within(bar).getByText('3 selected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeChecked();

    await userEvent.click(within(bar).getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
  });

  it('lifts toasts above the bar while it is shown, so they do not cover its actions', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [launch, podcast] } });
    renderApp('/ideas');
    expect(document.documentElement).not.toHaveClass('has-bulk-bar');

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select Podcast' }));
    expect(document.documentElement).toHaveClass('has-bulk-bar');
    expect(document.documentElement.style.getPropertyValue('--bulk-bar-height')).toMatch(/^\d+px$/);

    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(document.documentElement).not.toHaveClass('has-bulk-bar');
    expect(document.documentElement.style.getPropertyValue('--bulk-bar-height')).toBe('');
  });

  it('offers no selection on the archive, where ideas are read-only', async () => {
    fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [launch] },
      [`${ideasRoute}?archived=true`]: { status: 200, body: [anIdea({ title: 'Old plan', archivedAt: '2026-10-01T09:00:00Z' })] },
    });
    renderApp('/ideas');
    await screen.findByText('Spring launch');

    await userEvent.click(screen.getByRole('button', { name: 'Archived' }));

    expect(await screen.findByText('Old plan')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('changes the status of the selected ideas, and Undo puts each back to its own', async () => {
    const calls = fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [launch, podcast] }, 'POST /api/v1/ideas/bulk': bulkRoute([launch, podcast]) });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }));

    await userEvent.selectOptions(screen.getByLabelText('Change status'), 'Done');

    expect(await screen.findByText('Set 2 ideas to Done')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(bulkCalls(calls)).toHaveLength(3));
    expect(bulkCalls(calls)).toEqual([
      { ids: ['a', 'b'], operation: 'SetStatus', status: 'Done' },
      { ids: ['a'], operation: 'SetStatus', status: 'InProgress' },
      { ids: ['b'], operation: 'SetStatus', status: 'Planned' },
    ]);
  });

  it('reports the ideas a change could not apply to, and keeps them selected', async () => {
    fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [launch, webinar] },
      'POST /api/v1/ideas/bulk': bulkRoute([launch, webinar], { c: 'A completed idea cannot be postponed.' }),
    });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }));
    const bar = screen.getByRole('region', { name: 'Bulk actions' });

    await userEvent.click(within(bar).getByRole('button', { name: 'Target date…' }));
    fireEvent.change(within(bar).getByLabelText('New target date'), { target: { value: '2099-12-31' } });
    await userEvent.click(within(bar).getByRole('button', { name: 'Move' }));

    expect(await screen.findByText('Moved 1 idea to Thu, Dec 31, 2099. 1 idea couldn’t be changed.')).toBeInTheDocument();
    expect(within(bar).getByRole('alert')).toHaveTextContent('“Webinar”: A completed idea cannot be postponed.');
    expect(within(bar).getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Webinar' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Spring launch' })).not.toBeChecked();
  });

  it('keeps only the reasons, with nothing to act on, once the ideas left unchanged can no longer be selected', async () => {
    let refused = false;
    const calls = fakeApi({
      ...signedIn,
      // Taken off the user's team meanwhile: the idea is now read-only.
      [ideasRoute]: () => ({ status: 200, body: [refused ? { ...podcast, role: 'Viewer', canEdit: false } : podcast] }),
      'POST /api/v1/ideas/bulk': () => {
        refused = true;
        return { status: 200, body: [{ id: 'b', outcome: 'Forbidden', idea: null, message: 'You can no longer change this idea.' }] };
      },
    });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select Podcast' }));

    await userEvent.selectOptions(screen.getByLabelText('Change status'), 'Done');

    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Select Podcast' })).not.toBeInTheDocument());
    const bar = screen.getByRole('region', { name: 'Bulk actions' });
    expect(within(bar).getByRole('alert')).toHaveTextContent('“Podcast”: You can no longer change this idea.');
    expect(within(bar).queryByText('0 selected')).not.toBeInTheDocument();
    expect(within(bar).queryByLabelText('Change status')).not.toBeInTheDocument();
    expect(within(bar).queryByRole('button', { name: 'Tag…' })).not.toBeInTheDocument();
    expect(within(bar).queryByRole('button', { name: 'Target date…' })).not.toBeInTheDocument();
    expect(within(bar).queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();

    await userEvent.click(within(bar).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
    expect(bulkCalls(calls)).toHaveLength(1);
  });

  it('moves the selected ideas a week later, leaving out finished ones and saying so', async () => {
    const calls = fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [launch, webinar] }, 'POST /api/v1/ideas/bulk': bulkRoute([launch, webinar]) });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }));
    const bar = screen.getByRole('region', { name: 'Bulk actions' });

    await userEvent.click(within(bar).getByRole('button', { name: 'Target date…' }));
    expect(within(bar).getByText('1 selected idea is done and isn’t moved a week later.')).toBeInTheDocument();
    await userEvent.click(within(bar).getByRole('button', { name: '+1 week' }));

    expect(await screen.findByText('Postponed 1 idea by a week')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(bulkCalls(calls)).toEqual([{ ids: ['a'], operation: 'MoveTargetDate', days: 7 }]);
  });

  it('adds a tag to the selected ideas, counting and undoing only those it was added to', async () => {
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [launch, podcast] },
      'GET /api/v1/workspaces/ws-1/tags': { status: 200, body: ['q4'] },
      'POST /api/v1/ideas/bulk': bulkRoute([launch, podcast]),
    });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }));
    const bar = screen.getByRole('region', { name: 'Bulk actions' });

    await userEvent.click(within(bar).getByRole('button', { name: 'Tag…' }));
    await userEvent.type(within(bar).getByLabelText('Tag'), ' Q4 ');
    await userEvent.click(within(bar).getByRole('button', { name: 'Add tag' }));

    expect(await screen.findByText('Tagged 1 idea “q4”')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(bulkCalls(calls)).toHaveLength(2));
    expect(bulkCalls(calls)).toEqual([
      { ids: ['a', 'b'], operation: 'AddTag', tag: 'q4' },
      { ids: ['b'], operation: 'RemoveTag', tag: 'q4' },
    ]);
  });

  it('removes a tag from the selected ideas, counting and undoing only those that had it', async () => {
    const calls = fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [launch, podcast] }, 'POST /api/v1/ideas/bulk': bulkRoute([launch, podcast]) });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }));
    const bar = screen.getByRole('region', { name: 'Bulk actions' });

    await userEvent.click(within(bar).getByRole('button', { name: 'Tag…' }));
    await userEvent.type(within(bar).getByLabelText('Tag'), 'q4');
    await userEvent.click(within(bar).getByRole('button', { name: 'Remove tag' }));

    expect(await screen.findByText('Removed “q4” from 1 idea')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(bulkCalls(calls)).toHaveLength(2));
    expect(bulkCalls(calls)).toEqual([
      { ids: ['a', 'b'], operation: 'RemoveTag', tag: 'q4' },
      { ids: ['a'], operation: 'AddTag', tag: 'q4' },
    ]);
  });

  it('says so, with nothing to undo, when a tag change makes no difference to any selected idea', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [launch, podcast] }, 'POST /api/v1/ideas/bulk': bulkRoute([launch, podcast]) });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }));
    const bar = screen.getByRole('region', { name: 'Bulk actions' });

    await userEvent.click(within(bar).getByRole('button', { name: 'Tag…' }));
    await userEvent.type(within(bar).getByLabelText('Tag'), 'ops');
    await userEvent.click(within(bar).getByRole('button', { name: 'Remove tag' }));

    expect(await screen.findByText('None of the 2 ideas had “ops”')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select Spring launch' }));
    const again = screen.getByRole('region', { name: 'Bulk actions' });
    await userEvent.click(within(again).getByRole('button', { name: 'Tag…' }));
    await userEvent.type(within(again).getByLabelText('Tag'), 'q4');
    await userEvent.click(within(again).getByRole('button', { name: 'Add tag' }));

    expect(await screen.findByText('The idea already had “q4”')).toBeInTheDocument();
  });

  it('archives only the selected ideas the user may archive, saying which it leaves, and Undo restores them', async () => {
    const calls = fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [launch, podcast] }, 'POST /api/v1/ideas/bulk': bulkRoute([launch, podcast]) });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }));
    const bar = screen.getByRole('region', { name: 'Bulk actions' });

    expect(within(bar).getByText('1 selected idea can’t be archived: only an idea’s owner or a workspace admin can.')).toBeInTheDocument();
    await userEvent.click(within(bar).getByRole('button', { name: 'Archive' }));

    expect(await screen.findByText('Archived 1 idea')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(bulkCalls(calls)).toHaveLength(2));
    expect(bulkCalls(calls)).toEqual([
      { ids: ['a'], operation: 'Archive' },
      { ids: ['a'], operation: 'Restore' },
    ]);
  });

  it('does not archive when none of the selected ideas may be archived', async () => {
    const calls = fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [launch, podcast] }, 'POST /api/v1/ideas/bulk': bulkRoute([launch, podcast]) });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select Podcast' }));

    const archive = within(screen.getByRole('region', { name: 'Bulk actions' })).getByRole('button', { name: 'Archive' });
    expect(archive).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(archive);

    expect(bulkCalls(calls)).toEqual([]);
  });
});

