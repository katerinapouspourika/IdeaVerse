import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

const peopleRoutes = {
  ...signedIn,
  'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
  'GET /api/v1/workspaces/ws-1/invitations': { status: 200, body: [] },
  'GET /api/v1/workspaces/ws-1/invite-link': { status: 200, body: { url: null } },
  'GET /api/v1/workspaces/ws-1/join-requests': { status: 200, body: [] },
};

describe('Company domain and join requests', () => {
  it('turns on the suggested domain, then hides the workspace again', async () => {
    let current = { domain: null as string | null, discoverable: false, suggestedDomain: 'acme.com' };
    const calls = fakeApi({
      ...peopleRoutes,
      'GET /api/v1/workspaces/ws-1/discovery': () => ({ status: 200, body: current }),
      'PUT /api/v1/workspaces/ws-1/discovery': (body: unknown) => {
        current = { ...current, ...(body as typeof current) };
        return { status: 200, body: current };
      },
    });
    renderApp('/workspace/settings');

    const card = within(await screen.findByRole('region', { name: 'Company domain' }));
    await userEvent.click(await card.findByRole('button', { name: 'Use acme.com' }));
    expect(await card.findByText(/People who sign in with an @acme.com email can find this workspace/)).toBeInTheDocument();

    await userEvent.click(card.getByRole('checkbox', { name: 'Show this workspace to people at acme.com' }));

    expect(await card.findByText('This workspace is hidden from people at acme.com. Only people you invite can join.')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'PUT').map((c) => c.body)).toEqual([
      { domain: 'acme.com', discoverable: true },
      { domain: 'acme.com', discoverable: false },
    ]);
  });

  it('explains that a public email address cannot set a domain', async () => {
    fakeApi({ ...peopleRoutes, 'GET /api/v1/workspaces/ws-1/discovery': { status: 200, body: { domain: null, discoverable: false, suggestedDomain: null } } });
    renderApp('/workspace/settings');

    expect(await screen.findByText(/Your email is at a public provider/)).toBeInTheDocument();
  });

  it('approves someone asking to join', async () => {
    let requests = [{ id: 'r-1', email: 'mia@acme.com', name: 'Mia Chen', createdAt: '2026-10-11T09:00:00Z' }];
    const calls = fakeApi({
      ...peopleRoutes,
      'GET /api/v1/workspaces/ws-1/discovery': { status: 200, body: { domain: 'acme.com', discoverable: true, suggestedDomain: 'acme.com' } },
      'GET /api/v1/workspaces/ws-1/join-requests': () => ({ status: 200, body: requests }),
      'POST /api/v1/workspaces/ws-1/join-requests/r-1/approve': () => {
        requests = [];
        return { status: 204 };
      },
    });
    renderApp('/people');

    const card = within(await screen.findByRole('region', { name: 'Join requests' }));
    const members = screen.getByRole('region', { name: 'Members' });
    expect(screen.getByRole('region', { name: 'Join requests' }).compareDocumentPosition(members) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: 'People, 1 asking to join' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menu, 1 waiting' })).toBeInTheDocument();
    await userEvent.click(card.getByRole('button', { name: 'Approve Mia Chen' }));

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Join requests' })).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'People' })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/approve'))).toBe(true);
  });
});

describe('Finding the team by company domain', () => {
  it('lets someone without a workspace ask to join one at their company, and withdraw', async () => {
    let requested = false;
    const calls = fakeApi({
      ...signedIn,
      'GET /api/v1/workspaces': { status: 200, body: [] },
      'GET /api/v1/discover': () => ({ status: 200, body: [{ id: 'ws-9', name: 'Acme Product', memberCount: 6, requested }] }),
      'POST /api/v1/discover/ws-9/request': () => {
        requested = true;
        return { status: 204 };
      },
      'DELETE /api/v1/discover/ws-9/request': () => {
        requested = false;
        return { status: 204 };
      },
    });
    renderApp('/ideas');

    const card = within(await screen.findByRole('region', { name: 'Your team may already be here' }));
    expect(card.getByText('Workspaces at example.com. Ask to join, and an owner or admin will let you in.')).toBeInTheDocument();
    await userEvent.click(card.getByRole('button', { name: 'Ask to join Acme Product' }));
    expect(await card.findByText('6 people · Request sent')).toBeInTheDocument();
    await userEvent.click(card.getByRole('button', { name: 'Withdraw request to join Acme Product' }));

    expect(await card.findByRole('button', { name: 'Ask to join Acme Product' })).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/api/v1/discover/ws-9/request').map((c) => c.method)).toEqual(['POST', 'DELETE']);
  });
});
