import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Invitation, WorkspaceMember } from '../api/types';
import { aWorkspace, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

const kat: WorkspaceMember = { userId: 'u-kat', email: 'kat@example.com', role: 'Owner', joinedAt: '2026-10-01T09:00:00Z' };
const mia: WorkspaceMember = { userId: 'u-mia', email: 'mia@example.com', role: 'Member', joinedAt: '2026-10-02T09:00:00Z' };
const pending: Invitation = {
  id: 'inv-1',
  email: 'new@example.com',
  role: 'Member',
  invitedByEmail: 'kat@example.com',
  sentAt: '2026-10-03T09:00:00Z',
  expiresAt: '2099-10-10T09:00:00Z',
};

function peopleRoutes(role: 'Owner' | 'Member', members: WorkspaceMember[]) {
  return {
    ...signedIn,
    'GET /api/v1/workspaces': { status: 200, body: [aWorkspace({ role, memberCount: members.length })] },
    'GET /api/v1/workspaces/ws-1/members': { status: 200, body: members },
    'GET /api/v1/workspaces/ws-1/invitations': { status: 200, body: [pending] },
    [ideasRoute]: { status: 200, body: [] },
  };
}

describe('PeoplePage', () => {
  it('opens from the header and lists people with their roles', async () => {
    fakeApi(peopleRoutes('Owner', [kat, mia]));
    renderApp('/');

    await userEvent.click(await screen.findByRole('link', { name: 'People' }));

    expect(await screen.findByRole('heading', { name: 'People in Acme Marketing' })).toBeInTheDocument();
    const members = within(screen.getByRole('region', { name: 'Members' }));
    expect(members.getByText('Owner')).toBeInTheDocument();
    expect(members.getByRole('combobox', { name: 'Role of mia@example.com' })).toHaveValue('Member');
    expect(within(screen.getByRole('region', { name: 'Waiting to join' })).getByText('new@example.com')).toBeInTheDocument();
  });

  it('lets an admin invite someone by email and role', async () => {
    const calls = fakeApi({
      ...peopleRoutes('Owner', [kat]),
      'POST /api/v1/workspaces/ws-1/invitations': (body) => ({ status: 201, body: { ...pending, ...(body as object) } }),
    });
    renderApp('/people');

    const form = await screen.findByRole('form', { name: 'Invite people' });
    await userEvent.type(within(form).getByLabelText('Email'), 'leo@example.com');
    await userEvent.selectOptions(within(form).getByLabelText('Role'), 'Admin');
    await userEvent.click(within(form).getByRole('button', { name: 'Send invitation' }));

    expect(await within(form).findByRole('status')).toHaveTextContent('Invitation sent to leo@example.com.');
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ email: 'leo@example.com', role: 'Admin' });
  });

  it('shows why an invitation was refused', async () => {
    fakeApi({
      ...peopleRoutes('Owner', [kat, mia]),
      'POST /api/v1/workspaces/ws-1/invitations': { status: 400, body: { errors: { email: ['This person is already in the workspace.'] } } },
    });
    renderApp('/people');

    const form = await screen.findByRole('form', { name: 'Invite people' });
    await userEvent.type(within(form).getByLabelText('Email'), 'mia@example.com');
    await userEvent.click(within(form).getByRole('button', { name: 'Send invitation' }));

    expect(await within(form).findByText('This person is already in the workspace.')).toBeInTheDocument();
  });

  it('changes a role and revokes an invitation', async () => {
    const calls = fakeApi({
      ...peopleRoutes('Owner', [kat, mia]),
      'PUT /api/v1/workspaces/ws-1/members/u-mia': (body) => ({ status: 200, body: { ...mia, ...(body as object) } }),
      'DELETE /api/v1/workspaces/ws-1/invitations/inv-1': { status: 204 },
    });
    renderApp('/people');

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Role of mia@example.com' }), 'Admin');
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke invitation for new@example.com' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ role: 'Admin' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
  });

  it('shows a member the people without management, and lets them leave', async () => {
    const me: WorkspaceMember = { ...mia, userId: 'u-me', email: 'kat@example.com' };
    const owner: WorkspaceMember = { ...kat, email: 'leo@example.com' };
    const calls = fakeApi({
      ...peopleRoutes('Member', [owner, me]),
      'DELETE /api/v1/workspaces/ws-1/members/u-me': { status: 204 },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('/people');

    expect(await screen.findByText('Only the workspace’s owner and admins can invite people.')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Invite people' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Role of/ })).not.toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/invitations') && c.path.includes('ws-1'))).toBe(false);

    await userEvent.click(await screen.findByRole('button', { name: 'Leave workspace' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/v1/workspaces/ws-1/members/u-me')).toBe(true));
  });
});
