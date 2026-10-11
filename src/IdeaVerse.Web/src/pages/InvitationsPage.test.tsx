import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ReceivedInvitation } from '../api/types';
import { anIdea, aWorkspace, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

const invitation: ReceivedInvitation = {
  id: 'inv-1',
  workspaceId: 'ws-2',
  workspaceName: 'Globex',
  role: 'Admin',
  invitedByEmail: 'leo@example.com', invitedByName: null,
  expiresAt: '2099-01-08T09:00:00Z',
};

describe('InvitationsPage', () => {
  it('joins a workspace and opens it', async () => {
    let joined = false;
    const router = renderAppWith({
      'GET /api/v1/invitations': () => ({ status: 200, body: joined ? [] : [invitation] }),
      'GET /api/v1/workspaces': () => ({
        status: 200,
        body: joined ? [aWorkspace(), aWorkspace({ id: 'ws-2', name: 'Globex', role: 'Admin' })] : [aWorkspace()],
      }),
      'POST /api/v1/invitations/inv-1/accept': () => {
        joined = true;
        return { status: 200, body: aWorkspace({ id: 'ws-2', name: 'Globex', role: 'Admin' }) };
      },
      'GET /api/v1/workspaces/ws-2/ideas': { status: 200, body: [anIdea({ workspaceId: 'ws-2', title: 'Globex idea' })] },
    });

    expect(await screen.findByText(/leo@example.com invited you as an admin/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Join Globex' }));

    expect(await screen.findByText('Globex idea')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(screen.getByRole('combobox', { name: 'Workspace' })).toHaveValue('ws-2');
  });

  it('declines an invitation', async () => {
    let declined = false;
    const calls = fakeApi({
      ...signedIn,
      'GET /api/v1/invitations': () => ({ status: 200, body: declined ? [] : [invitation] }),
      'DELETE /api/v1/invitations/inv-1': () => {
        declined = true;
        return { status: 204 };
      },
    });
    renderApp('/invitations');

    await userEvent.click(await screen.findByRole('button', { name: 'Decline Globex' }));

    expect(await screen.findByText(/You have no open invitations/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
  });
});

function renderAppWith(routes: Parameters<typeof fakeApi>[0]) {
  fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] }, ...routes });
  return renderApp('/invitations');
}
