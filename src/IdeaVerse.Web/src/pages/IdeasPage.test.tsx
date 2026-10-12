import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ReceivedInvitation } from '../api/types';
import { anIdea, aWorkspace, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

describe('IdeasPage', () => {
  it('lists ideas with their status, overdue flag, progress, and who they belong to', async () => {
    fakeApi({
      ...signedIn,
      [ideasRoute]: {
        status: 200,
        body: [
          anIdea({ id: 'a', title: 'Spring launch', targetDate: '2020-03-01', isOverdue: true, componentCount: 4, completedComponentCount: 1 }),
          anIdea({ id: 'b', title: 'Podcast', status: 'Postponed', postponeCount: 2, role: 'Member', ownerEmail: 'leo@example.com' }),
          anIdea({ id: 'c', title: 'Webinar', role: 'Viewer', canEdit: false, canManage: false, ownerEmail: 'mia@example.com' }),
        ],
      },
    });

    renderApp('/ideas');

    const items = await within(screen.getByRole('main')).findAllByRole('listitem');
    expect(within(items[0]!).getByText('Spring launch')).toBeInTheDocument();
    expect(within(items[0]!).getByText('Overdue')).toBeInTheDocument();
    expect(within(items[0]!).getByText('1/4 ready')).toBeInTheDocument();
    expect(within(items[0]!).getByText('Only you')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Postponed')).toBeInTheDocument();
    expect(within(items[1]!).getByText('You’re on leo@example.com’s team')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Postponed 2×')).toBeInTheDocument();
    expect(within(items[2]!).getByText('By mia@example.com')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 overdue');
  });

  it('shows an empty state when there are no ideas', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });

    renderApp('/ideas');

    expect(await screen.findByText(/No ideas yet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add your first idea' }));
    expect(screen.getByRole('form', { name: 'New idea' })).toBeInTheDocument();
  });

  it('filters by status through the API', async () => {
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [anIdea()] },
      [`${ideasRoute}?status=Done`]: { status: 200, body: [] },
    });
    renderApp('/ideas');
    await screen.findByText('Black Friday teaser');

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findByText('No ideas match these filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/api/v1/workspaces/ws-1/ideas?status=Done')).toBe(true);
  });

  it('confirms a new idea in a toast naming it, whose Open goes to the idea', async () => {
    fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [] },
      'POST /api/v1/workspaces/ws-1/ideas': { status: 201, body: anIdea({ id: 'idea-9', title: 'Webinar series' }) },
    });
    const router = renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'New idea' }));

    const form = screen.getByRole('form', { name: 'New idea' });
    await userEvent.type(within(form).getByLabelText('Title'), 'Webinar series');
    await userEvent.click(within(form).getByRole('button', { name: 'Add idea' }));

    expect(await screen.findByText('Added “Webinar series”')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'New idea' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/ideas/idea-9'));
  });

  it('creates an idea in the current workspace and shows the API validation message for a bad date', async () => {
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [] },
      'POST /api/v1/workspaces/ws-1/ideas': { status: 400, body: { errors: { targetDate: ['The target date cannot be in the past.'] } } },
    });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'New idea' }));

    const form = screen.getByRole('form', { name: 'New idea' });
    await userEvent.type(within(form).getByLabelText('Title'), 'Webinar series');
    await userEvent.click(within(form).getByRole('button', { name: 'Add idea' }));

    expect(await within(form).findByText('The target date cannot be in the past.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ title: 'Webinar series', description: null });
  });

  it('switches workspace from the header and remembers the choice', async () => {
    fakeApi({
      ...signedIn,
      'GET /api/v1/workspaces': {
        status: 200,
        body: [aWorkspace(), aWorkspace({ id: 'ws-2', name: 'Globex', role: 'Member', memberCount: 5 })],
      },
      [ideasRoute]: { status: 200, body: [anIdea({ title: 'Acme idea' })] },
      'GET /api/v1/workspaces/ws-2/ideas': { status: 200, body: [anIdea({ id: 'g', workspaceId: 'ws-2', title: 'Globex idea' })] },
    });
    const router = renderApp('/ideas');
    await screen.findByText('Acme idea');

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Workspace' }), 'Globex');

    expect(await screen.findByText('Globex idea')).toBeInTheDocument();
    expect(screen.queryByText('Acme idea')).not.toBeInTheDocument();
    expect(localStorage.getItem('ideaverse.workspace')).toBe('ws-2');
    expect(router.state.location.pathname).toBe('/ideas');
  });

  it('leaves an idea for the new workspace’s list when switching workspace', async () => {
    fakeApi({
      ...signedIn,
      'GET /api/v1/workspaces': {
        status: 200,
        body: [aWorkspace(), aWorkspace({ id: 'ws-2', name: 'Globex', role: 'Member', memberCount: 5 })],
      },
      'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea({ title: 'Acme idea' }) },
      'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
      'GET /api/v1/ideas/idea-1/comments': { status: 200, body: [] },
      'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-2/ideas': { status: 200, body: [anIdea({ id: 'g', workspaceId: 'ws-2', title: 'Globex idea' })] },
    });
    const router = renderApp('/ideas/idea-1');
    await screen.findByRole('heading', { name: 'Acme idea' });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Workspace' }), 'Globex');

    expect(await screen.findByText('Globex idea')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ideas');
  });

  it('opens the new idea form only once when asked from the dashboard', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    const router = renderApp('/');

    await userEvent.click(await screen.findByRole('link', { name: 'New idea' }));

    expect(await screen.findByRole('form', { name: 'New idea' })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.state).toBeNull());
  });

  describe('without a workspace', () => {
    const invitation: ReceivedInvitation = {
      id: 'inv-1',
      workspaceId: 'ws-2',
      workspaceName: 'Globex',
      role: 'Member',
      invitedByEmail: 'leo@example.com', invitedByName: null,
      expiresAt: '2099-01-08T09:00:00Z',
    };

    it('welcomes the user and creates their first workspace', async () => {
      let workspaces: unknown[] = [];
      const calls = fakeApi({
        ...signedIn,
        'GET /api/v1/workspaces': () => ({ status: 200, body: workspaces }),
        'POST /api/v1/workspaces': (body) => {
          workspaces = [aWorkspace({ name: (body as { name: string }).name })];
          return { status: 201, body: workspaces[0] };
        },
        [ideasRoute]: { status: 200, body: [] },
      });
      renderApp('/ideas');

      expect(await screen.findByRole('heading', { name: 'Welcome to IdeaVerse' })).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Setting up your workspace' })).toHaveTextContent('1Name your workspace2Invite your team');
      const form = screen.getByRole('form', { name: 'Create workspace' });
      await userEvent.type(within(form).getByLabelText('Workspace name'), 'Acme Marketing');
      await userEvent.click(within(form).getByRole('button', { name: 'Create workspace' }));

      expect(await screen.findByRole('heading', { name: 'Invite your team to Acme Marketing' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

      expect(await screen.findByRole('heading', { name: 'Ideas' })).toBeInTheDocument();
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Acme Marketing' });
    });

    it('invites the team in the second step, keeping only the addresses that were refused', async () => {
      const calls = fakeApi({
        ...signedIn,
        [ideasRoute]: { status: 200, body: [] },
        'POST /api/v1/workspaces/ws-1/invitations': (body) =>
          (body as { email: string }).email === 'kat@example.com'
            ? { status: 400, body: { errors: { email: ['This person is already in the workspace.'] } } }
            : { status: 201, body: {} },
      });
      const router = renderApp('/workspaces/ws-1/invite');

      const form = await screen.findByRole('form', { name: 'Invite your team' });
      await userEvent.type(within(form).getByLabelText('Email 1'), 'mia@example.com');
      await userEvent.type(within(form).getByLabelText('Email 2'), 'kat@example.com');
      await userEvent.selectOptions(within(form).getByLabelText('Invite them as'), 'Admin');
      await userEvent.click(within(form).getByRole('button', { name: 'Send invitations' }));

      expect(await screen.findByText('Invitation sent')).toBeInTheDocument();
      expect(within(form).getByLabelText('Email 1')).toHaveValue('kat@example.com');
      expect(within(form).getByLabelText('Email 1')).toHaveAccessibleDescription('This person is already in the workspace.');
      expect(within(form).queryByLabelText('Email 2')).not.toBeInTheDocument();
      expect(calls.filter((c) => c.method === 'POST').map((c) => c.body)).toEqual([
        { email: 'mia@example.com', role: 'Admin' },
        { email: 'kat@example.com', role: 'Admin' },
      ]);
      expect(router.state.location.pathname).toBe('/workspaces/ws-1/invite');
    });

    it('does not offer to invite to a workspace the user cannot manage', async () => {
      fakeApi({ ...signedIn, 'GET /api/v1/workspaces': { status: 200, body: [aWorkspace({ role: 'Member' })] }, [ideasRoute]: { status: 200, body: [] } });
      const router = renderApp('/workspaces/ws-1/invite');

      await waitFor(() => expect(router.state.location.pathname).toBe('/ideas'));
    });

    it('joins a workspace they were invited to', async () => {
      let workspaces: unknown[] = [];
      const calls = fakeApi({
        ...signedIn,
        'GET /api/v1/workspaces': () => ({ status: 200, body: workspaces }),
        'GET /api/v1/invitations': () => ({ status: 200, body: workspaces.length ? [] : [invitation] }),
        'POST /api/v1/invitations/inv-1/accept': () => {
          workspaces = [aWorkspace({ id: 'ws-2', name: 'Globex', role: 'Member' })];
          return { status: 200, body: workspaces[0] };
        },
        'GET /api/v1/workspaces/ws-2/ideas': { status: 200, body: [anIdea({ workspaceId: 'ws-2', title: 'Globex idea', role: 'Viewer' })] },
      });
      renderApp('/ideas');

      expect(await screen.findByText(/leo@example.com invited you as a member/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Join Globex' }));

      expect(await screen.findByText('Globex idea')).toBeInTheDocument();
      await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/api/v1/invitations/inv-1/accept')).toBe(true));
    });
  });
});
