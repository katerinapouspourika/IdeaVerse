import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Component, Idea, Member, WorkspaceMember } from '../api/types';
import { anIdea, aWorkspace, fakeApi, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

const owner: Member = { userId: 'u-kat', email: 'kat@example.com', role: 'Owner', addedAt: '2026-10-01T09:00:00Z' };
const mia: Member = { userId: 'u-mia', email: 'mia@example.com', role: 'Member', addedAt: '2026-10-02T09:00:00Z' };
const people: WorkspaceMember[] = [
  { userId: 'u-kat', email: 'kat@example.com', role: 'Owner', joinedAt: '2026-10-01T09:00:00Z' },
  { userId: 'u-mia', email: 'mia@example.com', role: 'Member', joinedAt: '2026-10-01T09:00:00Z' },
  { userId: 'u-leo', email: 'leo@example.com', role: 'Member', joinedAt: '2026-10-01T09:00:00Z' },
];
const budget: Component = {
  id: 'c-1',
  title: 'Budget sign-off',
  notes: null,
  isDone: false,
  position: 0,
  createdAt: '2026-10-01T09:00:00Z',
  completedAt: null,
};

const asMember: Partial<Idea> = { role: 'Member', canManage: false, ownerEmail: 'leo@example.com' };
const asViewer: Partial<Idea> = { role: 'Viewer', canEdit: false, canManage: false, ownerEmail: 'leo@example.com' };

function ideaRoutes(access: Partial<Idea>, team: Member[]) {
  return {
    ...signedIn,
    'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea({ ...access, componentCount: 1 }) },
    'GET /api/v1/ideas/idea-1/components': { status: 200, body: [budget] },
    'GET /api/v1/ideas/idea-1/members': { status: 200, body: team },
    'GET /api/v1/workspaces/ws-1/members': { status: 200, body: people },
  };
}

describe('IdeaPage', () => {
  it('lets the owner manage the team and delete the idea', async () => {
    fakeApi(ideaRoutes({}, [owner, mia]));

    renderApp('/ideas/idea-1');

    expect(await screen.findByRole('heading', { name: 'Black Friday teaser' })).toBeInTheDocument();
    expect(await screen.findByRole('form', { name: 'Add team member' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete idea' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('hides management from a team member but lets them edit and leave', async () => {
    fakeApi({ ...ideaRoutes(asMember, [owner, { ...mia, email: 'kat@example.com', userId: 'u-me' }]) });

    renderApp('/ideas/idea-1');

    expect(await screen.findByText('Only the idea’s owner and the workspace’s admins can add or remove team members.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete idea' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Leave' })).toBeInTheDocument();
  });

  it('shows the idea read-only to someone else in the workspace', async () => {
    fakeApi(ideaRoutes(asViewer, [owner, mia]));

    renderApp('/ideas/idea-1');

    expect(await screen.findByText(/leo@example.com’s idea\. You can follow it here/)).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: /Budget sign-off/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Postpone idea' })).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Add component' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete idea' })).not.toBeInTheDocument();
  });

  it('switches the header to the idea’s workspace when opened from another one', async () => {
    fakeApi({
      ...ideaRoutes({ workspaceId: 'ws-2' }, [owner]),
      'GET /api/v1/workspaces': { status: 200, body: [aWorkspace(), aWorkspace({ id: 'ws-2', name: 'Globex' })] },
      'GET /api/v1/workspaces/ws-2/members': { status: 200, body: people },
    });

    renderApp('/ideas/idea-1');

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Workspace' })).toHaveValue('ws-2'));
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
      expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ title: 'Budget sign-off', notes: null, isDone: true }),
    );
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

  it('postpones the idea to a later date', async () => {
    const calls = fakeApi({
      ...ideaRoutes({}, [owner]),
      'POST /api/v1/ideas/idea-1/postpone': (body) => ({ status: 200, body: anIdea({ ...(body as object), status: 'Postponed', postponeCount: 1 }) }),
    });
    renderApp('/ideas/idea-1');

    const form = await screen.findByRole('form', { name: 'Postpone idea' });
    const date = within(form).getByLabelText('New date');
    await userEvent.clear(date);
    await userEvent.type(date, '2099-12-31');
    await userEvent.click(within(form).getByRole('button', { name: 'Postpone' }));

    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/postpone'))?.body).toEqual({ targetDate: '2099-12-31' }));
  });

  it('explains when the idea is missing or in another workspace', async () => {
    fakeApi({ ...signedIn, 'GET /api/v1/ideas/nope': { status: 404 } });

    renderApp('/ideas/nope');

    expect(await screen.findByText(/doesn’t exist or isn’t in one of your workspaces/)).toBeInTheDocument();
  });

  it('adds someone from the workspace who is not on the team yet', async () => {
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
  });
});
