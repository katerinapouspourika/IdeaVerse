import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { aWorkspace, fakeApi, ideasRoute, signedIn, signedOut } from '../test/fakeApi';
import { renderApp } from '../test/render';

const link = 'https://app.example.com/join/abc123';

const peopleRoutes = {
  ...signedIn,
  'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
  'GET /api/v1/workspaces/ws-1/invitations': { status: 200, body: [] },
};

describe('Invite link in Workspace settings', () => {
  it('turns the link on, then replaces it after asking', async () => {
    let current: string | null = null;
    const calls = fakeApi({
      ...peopleRoutes,
      'GET /api/v1/workspaces/ws-1/invite-link': () => ({ status: 200, body: { url: current } }),
      'POST /api/v1/workspaces/ws-1/invite-link': () => {
        current = current ? `${link}-2` : link;
        return { status: 200, body: { url: current } };
      },
    });
    renderApp('/workspace/settings');

    const card = within(await screen.findByRole('region', { name: 'Invite link' }));
    await userEvent.click(await card.findByRole('button', { name: 'Turn on invite link' }));
    expect(await card.findByRole('textbox', { name: 'Invite link' })).toHaveValue(link);

    await userEvent.click(card.getByRole('button', { name: 'Create a new link' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Create new link' }));

    await waitFor(() => expect(card.getByRole('textbox', { name: 'Invite link' })).toHaveValue(`${link}-2`));
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2);
  });

  it('turns the link off', async () => {
    const calls = fakeApi({
      ...peopleRoutes,
      'GET /api/v1/workspaces/ws-1/invite-link': { status: 200, body: { url: link } },
      'DELETE /api/v1/workspaces/ws-1/invite-link': { status: 204 },
    });
    renderApp('/workspace/settings');

    const card = within(await screen.findByRole('region', { name: 'Invite link' }));
    await userEvent.click(await card.findByRole('button', { name: 'Turn off' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Turn off' }));

    expect(await card.findByRole('button', { name: 'Turn on invite link' })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
  });

  it('is not shown to members', async () => {
    fakeApi({ ...peopleRoutes, 'GET /api/v1/workspaces': { status: 200, body: [aWorkspace({ role: 'Member' })] } });
    renderApp('/workspace/settings');

    expect(await screen.findByText(/Only the workspace’s owner and admins can change/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Invite link' })).not.toBeInTheDocument();
  });
});

describe('Joining through an invite link', () => {
  afterEach(() => localStorage.clear());

  it('asks someone signed out to sign in, and remembers the link for after', async () => {
    fakeApi(signedOut);
    renderApp('/join/abc123');

    expect(await screen.findByRole('heading', { name: 'You’ve been invited to a workspace' })).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem('ideaverse.pendingJoin')).toBe('abc123'));
  });

  it('comes back to the link after signing in', async () => {
    localStorage.setItem('ideaverse.pendingJoin', 'abc123');
    let signedInNow = false;
    fakeApi({
      ...signedIn,
      'GET /api/v1/account': () => (signedInNow ? signedIn['GET /api/v1/account'] : { status: 401 }),
      'POST /api/v1/auth/login?useCookies=true': () => {
        signedInNow = true;
        return { status: 200, body: {} };
      },
      'GET /api/v1/join/abc123': { status: 200, body: { workspaceId: 'ws-2', name: 'Globex', memberCount: 4, alreadyMember: false } },
    });
    const router = renderApp('/login');

    await userEvent.type(await screen.findByLabelText('Email'), 'kat@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/join/abc123'));
    expect(await screen.findByRole('heading', { name: 'Join Globex' })).toBeInTheDocument();
  });

  it('joins the workspace and opens it', async () => {
    let workspaces = [aWorkspace()];
    const calls = fakeApi({
      ...signedIn,
      'GET /api/v1/workspaces': () => ({ status: 200, body: workspaces }),
      'GET /api/v1/join/abc123': { status: 200, body: { workspaceId: 'ws-2', name: 'Globex', memberCount: 4, alreadyMember: false } },
      'POST /api/v1/join/abc123': () => {
        const globex = aWorkspace({ id: 'ws-2', name: 'Globex', role: 'Member' });
        workspaces = [...workspaces, globex];
        return { status: 200, body: globex };
      },
      'GET /api/v1/workspaces/ws-2/ideas': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-2/assignments': { status: 200, body: [] },
    });
    const router = renderApp('/join/abc123');

    expect(await screen.findByText('4 people are planning ideas there. You’ll join as a member.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Join workspace' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/ideas'));
    expect(await screen.findByText('Welcome to Globex!')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Workspace' })).toHaveValue('ws-2'));
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/v1/join/abc123')).toBe(true);
  });

  it('says when the link no longer works', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] }, 'GET /api/v1/join/old': { status: 404 } });
    renderApp('/join/old');

    expect(await screen.findByRole('heading', { name: 'This invite link doesn’t work anymore' })).toBeInTheDocument();
  });
});
