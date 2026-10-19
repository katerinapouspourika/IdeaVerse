import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { addDays, formatDate, todayIso } from '../api/dates';
import type { Component, Idea, Member, WorkspaceMember } from '../api/types';
import { anIdea, aWorkspace, fakeApi, signedIn, signedInAccount } from '../test/fakeApi';
import { confirmDialog } from '../test/dialog';
import { renderApp } from '../test/render';

const owner: Member = { userId: 'u-kat', email: 'kat@example.com', name: null, role: 'Owner', addedAt: '2026-10-01T09:00:00Z' };
const mia: Member = { userId: 'u-mia', email: 'mia@example.com', name: null, role: 'Member', addedAt: '2026-10-02T09:00:00Z' };
const people: WorkspaceMember[] = [
  { userId: 'u-kat', email: 'kat@example.com', name: null, role: 'Owner', joinedAt: '2026-10-01T09:00:00Z' },
  { userId: 'u-mia', email: 'mia@example.com', name: null, role: 'Member', joinedAt: '2026-10-01T09:00:00Z' },
  { userId: 'u-leo', email: 'leo@example.com', name: null, role: 'Member', joinedAt: '2026-10-01T09:00:00Z' },
];
const budget: Component = {
  id: 'c-1',
  title: 'Budget sign-off',
  notes: null,
  isDone: false,
  position: 0,
  createdAt: '2026-10-01T09:00:00Z',
  completedAt: null,
  assigneeId: null,
  assigneeEmail: null,
  assigneeName: null,
  dueDate: null,
};

const asMember: Partial<Idea> = { role: 'Member', canManage: false, ownerEmail: 'leo@example.com' };
const asViewer: Partial<Idea> = { role: 'Viewer', canEdit: false, canManage: false, ownerEmail: 'leo@example.com' };

function ideaRoutes(access: Partial<Idea>, team: Member[]) {
  return {
    ...signedIn,
    'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea({ ...access, componentCount: 1 }) },
    'GET /api/v1/ideas/idea-1/components': { status: 200, body: [budget] },
    'GET /api/v1/ideas/idea-1/comments': { status: 200, body: [] },
    'GET /api/v1/ideas/idea-1/members': { status: 200, body: team },
    'GET /api/v1/workspaces/ws-1/members': { status: 200, body: people },
  };
}

describe('IdeaPage', () => {
  it('shows the day the idea was created by the account’s own calendar, not UTC’s', async () => {
    fakeApi({
      ...ideaRoutes({}, [owner]),
      'GET /api/v1/account': { status: 200, body: { ...signedInAccount, timeZone: 'Pacific/Kiritimati' } },
      // 20:00 UTC on the 19th is already 10:00 on the 20th in Kiritimati (UTC+14).
      'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea({ componentCount: 1, createdAt: '2026-10-19T20:00:00Z' }) },
    });

    renderApp('/ideas/idea-1');

    const created = await screen.findByText('Created');
    expect(created.nextElementSibling).toHaveTextContent(formatDate('2026-10-20'));
  });

  it('lets the owner manage the team and delete the idea', async () => {
    fakeApi(ideaRoutes({}, [owner, mia]));

    renderApp('/ideas/idea-1');

    expect(await screen.findByRole('heading', { name: 'Black Friday teaser' })).toBeInTheDocument();
    expect(await screen.findByRole('form', { name: 'Add team member' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menuitem', { name: 'Archive idea' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete idea' })).toBeInTheDocument();
  });

  it('reads in phone order: the details, what it needs and the discussion, then the schedule, priority, and team, and the activity last', async () => {
    fakeApi(ideaRoutes({}, [owner]));

    renderApp('/ideas/idea-1');

    const title = await screen.findByRole('heading', { name: 'Black Friday teaser' });
    const side = screen.getByRole('complementary', { name: 'Idea details' });
    expect(within(side).getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
    const order = [
      title,
      screen.getByRole('heading', { name: 'What it needs' }),
      screen.getByRole('heading', { name: 'Discussion' }),
      side,
      screen.getByRole('heading', { name: 'Activity' }),
    ];
    order.slice(1).forEach((next, i) => {
      expect(order[i]!.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('deletes the idea after confirming, and returns to the list', async () => {
    const calls = fakeApi({ ...ideaRoutes({}, [owner]), 'DELETE /api/v1/ideas/idea-1': { status: 204 }, 'GET /api/v1/workspaces/ws-1/ideas': { status: 200, body: [] } });
    const router = renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'More actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete idea' }));
    expect(screen.getByRole('alertdialog', { name: 'Delete “Black Friday teaser”?' })).toBeInTheDocument();
    await confirmDialog('Delete idea');

    await waitFor(() => expect(router.state.location.pathname).toBe('/ideas'));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
    expect(await screen.findByText('Deleted “Black Friday teaser”')).toBeInTheDocument();
  });

  it('keeps the idea when the deletion is cancelled', async () => {
    const calls = fakeApi(ideaRoutes({}, [owner]));
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'More actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete idea' }));
    await confirmDialog('Cancel');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('hides management from a team member but lets them edit and leave', async () => {
    fakeApi({ ...ideaRoutes(asMember, [owner, { ...mia, email: 'kat@example.com', userId: 'u-me' }]) });

    renderApp('/ideas/idea-1');

    expect(await screen.findByText('Only the idea’s owner and the workspace’s admins can add or remove team members.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Leave' })).toBeInTheDocument();
  });

  it('shows the idea read-only to someone else in the workspace', async () => {
    fakeApi(ideaRoutes(asViewer, [owner, mia]));

    renderApp('/ideas/idea-1');

    expect(await screen.findByText(/leo@example.com’s idea\. You can follow it here/)).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: /Budget sign-off/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Postpone' })).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Add component' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
  });

  it('switches the header to the idea’s workspace when opened from another one', async () => {
    fakeApi({
      ...ideaRoutes({ workspaceId: 'ws-2' }, [owner]),
      'GET /api/v1/workspaces': { status: 200, body: [aWorkspace(), aWorkspace({ id: 'ws-2', name: 'Globex' })] },
      'GET /api/v1/workspaces/ws-2/members': { status: 200, body: people },
    });

    renderApp('/ideas/idea-1');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Workspace: Globex' })).toBeInTheDocument());
  });

  it('checks off a component and keeps it checked once saved', async () => {
    let saved = budget;
    const calls = fakeApi({
      ...ideaRoutes({}, [owner]),
      'GET /api/v1/ideas/idea-1/components': () => ({ status: 200, body: [saved] }),
      'PUT /api/v1/ideas/idea-1/components/c-1': (body) => {
        saved = { ...saved, ...(body as Partial<Component>) };
        return { status: 200, body: saved };
      },
    });
    renderApp('/ideas/idea-1');

    const checkbox = await screen.findByRole('checkbox', { name: /Budget sign-off/ });
    await userEvent.click(checkbox);

    await waitFor(() => expect(checkbox).toBeChecked());
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ title: 'Budget sign-off', notes: null, isDone: true, assigneeId: null, dueDate: null }),
    );
  });

  it('sums up the checklist’s progress at the top of its card, and updates it as components are done', async () => {
    let saved = [budget, { ...budget, id: 'c-2', title: 'Book the venue', isDone: true }];
    fakeApi({
      ...ideaRoutes({}, [owner]),
      'GET /api/v1/ideas/idea-1/components': () => ({ status: 200, body: saved }),
      'PUT /api/v1/ideas/idea-1/components/c-1': (body) => {
        saved = [{ ...budget, ...(body as Partial<Component>) }, saved[1]!];
        return { status: 200, body: saved[0] };
      },
    });
    renderApp('/ideas/idea-1');

    const checklist = await screen.findByRole('region', { name: 'What it needs' });
    const progress = await within(checklist).findByRole('progressbar', { name: '1 of 2 done' });
    expect(progress).toHaveAttribute('aria-valuenow', '1');
    expect(progress).toHaveAttribute('aria-valuemax', '2');
    expect(within(checklist).getByText('50%')).toBeInTheDocument();
    expect(screen.queryByText(/ready$/)).not.toBeInTheDocument();

    await userEvent.click(within(checklist).getByRole('checkbox', { name: /Budget sign-off/ }));

    expect(await within(checklist).findByRole('progressbar', { name: 'All 2 done' })).toHaveAttribute('aria-valuenow', '2');
    expect(within(checklist).getByText('100%')).toBeInTheDocument();
  });

  it('leaves the progress out while the checklist is empty', async () => {
    fakeApi({ ...ideaRoutes({}, [owner]), 'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] } });
    renderApp('/ideas/idea-1');

    expect(await screen.findByText('Nothing listed yet.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('unticks a component again when the API rejects the change', async () => {
    fakeApi({
      ...ideaRoutes({}, [owner]),
      'PUT /api/v1/ideas/idea-1/components/c-1': { status: 500, body: { title: 'Server error' } },
    });
    renderApp('/ideas/idea-1');

    const checkbox = await screen.findByRole('checkbox', { name: /Budget sign-off/ });
    await userEvent.click(checkbox);

    expect(await screen.findByRole('alert')).toHaveTextContent('Server error');
    await waitFor(() => expect(checkbox).not.toBeChecked());
  });

  it('postpones the idea to a picked date from the Postpone menu', async () => {
    const calls = fakeApi({
      ...ideaRoutes({}, [owner]),
      'POST /api/v1/ideas/idea-1/postpone': (body) => ({ status: 200, body: anIdea({ ...(body as object), status: 'Postponed', postponeCount: 1 }) }),
    });
    renderApp('/ideas/idea-1');

    expect(screen.queryByRole('form', { name: 'Postpone idea' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Postpone' }, { timeout: 5000 }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Pick a date…' }));
    const form = screen.getByRole('form', { name: 'Postpone idea' });
    const date = within(form).getByLabelText('Not the right time? Move it to');
    expect(date).toHaveFocus();
    expect(date).toHaveAttribute('min', '2099-11-28');
    await userEvent.clear(date);
    await userEvent.type(date, '2099-12-31');
    await userEvent.click(within(form).getByRole('button', { name: 'Postpone' }));

    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/postpone'))?.body).toEqual({ targetDate: '2099-12-31' }));
    expect(await screen.findByText(/^Postponed to /)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Postpone idea' })).not.toBeInTheDocument());
  });

  it('postpones by a week or a month from the target date', async () => {
    const calls = fakeApi({
      ...ideaRoutes({ targetDate: '2099-01-31' }, [owner]),
      'POST /api/v1/ideas/idea-1/postpone': (body) => ({ status: 200, body: anIdea({ ...(body as object), status: 'Postponed', postponeCount: 1 }) }),
    });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'Postpone' }, { timeout: 5000 }));
    expect(screen.getByRole('menuitem', { name: /^\+1 week · / })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: /^\+1 month · / }));

    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/postpone'))?.body).toEqual({ targetDate: '2099-02-28' }));
    expect(await screen.findByText(/^Postponed to /)).toBeInTheDocument();
  });

  it('offers no preset that would land in the past for an overdue idea', async () => {
    fakeApi(ideaRoutes({ targetDate: addDays(todayIso(), -10), isOverdue: true }, [owner]));
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'Postpone' }, { timeout: 5000 }));

    expect(screen.queryByRole('menuitem', { name: /^\+1 week/ })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^\+1 month/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Pick a date…' }));
    expect(screen.getByLabelText('Not the right time? Move it to')).toHaveAttribute('min', todayIso());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('form', { name: 'Postpone idea' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Postpone' })).toHaveFocus();
  });

  it('takes the postponement back with Undo, restoring the earlier date and status', async () => {
    const idea = anIdea({ status: 'InProgress' });
    const calls = fakeApi({
      ...ideaRoutes({ status: 'InProgress' }, [owner]),
      'POST /api/v1/ideas/idea-1/postpone': (body) => ({ status: 200, body: anIdea({ ...(body as object), status: 'Postponed', postponeCount: 1 }) }),
      'POST /api/v1/ideas/idea-1/postpone/undo': (body) => ({ status: 200, body: anIdea({ ...(body as object), postponeCount: 0 }) }),
    });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'Postpone' }, { timeout: 5000 }));
    await userEvent.click(screen.getByRole('menuitem', { name: /^\+1 week · / }));
    await screen.findByText(/^Postponed to /);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/postpone/undo'))?.body).toEqual({ targetDate: idea.targetDate, status: 'InProgress' }));
    expect(await screen.findByText(/^Back to /)).toBeInTheDocument();
  });

  it('sums the idea up in one row of chips under its title, saying when it is overdue', async () => {
    fakeApi(ideaRoutes({ targetDate: addDays(todayIso(), -2), isOverdue: true, startDate: addDays(todayIso(), -9), tags: ['launch'], ownerName: 'Kat' }, [owner]));
    renderApp('/ideas/idea-1');

    const heading = (await screen.findByRole('heading', { name: 'Black Friday teaser' })).closest('section')!;
    const chips = [...heading.querySelectorAll('.fact-chip')];
    expect(chips.map((chip) => chip.textContent)).toEqual([
      expect.stringMatching(/^Overdue · Target .+ \(2 days ago\)$/),
      expect.stringMatching(/^Starts /),
      'Owner Kat',
    ]);
    expect(chips[0]).toHaveClass('overdue');
    expect(within(heading).queryByText(/^Target date/)).not.toBeInTheDocument();
    expect(within(heading).getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
    expect(within(heading).getByRole('link', { name: 'Ideas tagged launch' })).toBeInTheDocument();
    expect(within(heading).queryByText('Overdue')).not.toBeInTheDocument();
  });

  it('shows the status as a plain chip to someone who cannot change it', async () => {
    fakeApi(ideaRoutes(asViewer, [owner]));
    renderApp('/ideas/idea-1');

    const heading = (await screen.findByRole('heading', { name: 'Black Friday teaser' })).closest('section')!;
    expect(within(heading).getByText('Planned')).toBeInTheDocument();
    expect(within(heading).queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Postpone' })).not.toBeInTheDocument();
  });

  it('explains when the idea is missing or in another workspace', async () => {
    fakeApi({ ...signedIn, 'GET /api/v1/ideas/nope': { status: 404 } });

    renderApp('/ideas/nope');

    expect(await screen.findByText(/doesn’t exist or isn’t in one of your workspaces/)).toBeInTheDocument();
  });

  it('adds someone from the workspace who is not on the team yet, confirming it in a toast', async () => {
    const calls = fakeApi({
      ...ideaRoutes({}, [owner, mia]),
      'POST /api/v1/ideas/idea-1/members': { status: 201, body: { ...mia, userId: 'u-leo', email: 'leo@example.com' } },
    });
    renderApp('/ideas/idea-1');

    const form = await screen.findByRole('form', { name: 'Add team member' });
    const person = within(form).getByLabelText('Add someone from the workspace');
    await waitFor(() => expect(within(person).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose a person…', 'leo@example.com']));
    await userEvent.selectOptions(person, 'leo@example.com');
    await userEvent.click(within(form).getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ email: 'leo@example.com' }));
    expect(await screen.findByText('Added leo@example.com to the team')).toBeInTheDocument();
  });
});

describe('Archived idea', () => {
  const archivedAt = '2026-10-05T09:00:00Z';

  function archivedRoutes(access: Partial<Idea>) {
    return { ...ideaRoutes(access, [owner, mia]), 'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea({ ...access, componentCount: 1, archivedAt }) } };
  }

  it('is read-only for its owner apart from the discussion, until restored', async () => {
    let archived = true;
    const calls = fakeApi({
      ...archivedRoutes({}),
      'GET /api/v1/ideas/idea-1': () => ({ status: 200, body: anIdea({ componentCount: 1, archivedAt: archived ? archivedAt : null }) }),
      'POST /api/v1/ideas/idea-1/restore': () => {
        archived = false;
        return { status: 200, body: anIdea({ componentCount: 1 }) };
      },
    });
    renderApp('/ideas/idea-1');

    const banner = await screen.findByText(/This idea is archived and read-only/);
    expect(banner).toHaveTextContent('but you can still discuss it. Restore it to make changes.');
    // Voting on an archived idea is closed, so the banner doesn't offer it.
    expect(banner).not.toHaveTextContent(/vote/i);
    expect(await screen.findByText('Budget sign-off')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Budget sign-off' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Rename Budget sign-off' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions for Budget sign-off' })).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Add component' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Postpone' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Impact')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Vote for Black Friday teaser/ })).not.toBeInTheDocument();
    expect(await screen.findByText('The team can’t change while the idea is archived.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Add team member' })).not.toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Add comment' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));

    expect(await screen.findByRole('button', { name: 'Edit details' })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/v1/ideas/idea-1/restore')).toBe(true);
    expect(screen.queryByText(/This idea is archived/)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Budget sign-off' })).toBeEnabled();
  });

  it('tells a team member who can restore it, without a Restore button', async () => {
    fakeApi(archivedRoutes(asMember));
    renderApp('/ideas/idea-1');

    expect(await screen.findByText(/This idea is archived and read-only/)).toHaveTextContent('Its owner or a workspace admin can restore it.');
    expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
    expect(await screen.findByText('The team can’t change while the idea is archived.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument();
  });
});
