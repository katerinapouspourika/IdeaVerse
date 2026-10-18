import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Invitation, WorkspaceMember } from '../api/types';
import { aWorkspace, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { confirmDialog } from '../test/dialog';
import { renderApp } from '../test/render';

const kat: WorkspaceMember = { userId: 'u-kat', email: 'kat@example.com', name: null, role: 'Owner', joinedAt: '2026-10-01T09:00:00Z' };
const mia: WorkspaceMember = { userId: 'u-mia', email: 'mia@example.com', name: null, role: 'Member', joinedAt: '2026-10-02T09:00:00Z' };
const pending: Invitation = {
  id: 'inv-1',
  email: 'new@example.com',
  role: 'Member',
  invitedByEmail: 'kat@example.com', invitedByName: null,
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
    expect(await members.findByText('Owner')).toBeInTheDocument();
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

  it('explains that an address already has an open invitation', async () => {
    fakeApi({
      ...peopleRoutes('Owner', [kat]),
      'POST /api/v1/workspaces/ws-1/invitations': {
        status: 409,
        body: { detail: 'new@example.com already has an open invitation. Resend it from the list of people waiting to join.' },
      },
    });
    renderApp('/people');

    const form = await screen.findByRole('form', { name: 'Invite people' });
    await userEvent.type(within(form).getByLabelText('Email'), 'new@example.com');
    await userEvent.click(within(form).getByRole('button', { name: 'Send invitation' }));

    expect(await within(form).findByText(/new@example.com already has an open invitation/)).toBeInTheDocument();
    expect(within(form).queryByRole('status')).not.toBeInTheDocument();
  });

  it('resends an open invitation with its own role', async () => {
    const calls = fakeApi({
      ...peopleRoutes('Owner', [kat]),
      'POST /api/v1/workspaces/ws-1/invitations/inv-1/resend': { status: 200, body: pending },
    });
    renderApp('/people');

    await userEvent.click(await screen.findByRole('button', { name: 'Resend invitation to new@example.com' }));

    expect(await screen.findByText('Invitation sent again to new@example.com')).toBeInTheDocument();
    expect(calls.find((c) => c.path.endsWith('/resend'))?.body).toBeUndefined();
  });

  it('changes a role and revokes an invitation', async () => {
    const calls = fakeApi({
      ...peopleRoutes('Owner', [kat, mia]),
      'PUT /api/v1/workspaces/ws-1/members/u-mia': (body) => ({ status: 200, body: { ...mia, ...(body as object) } }),
      'DELETE /api/v1/workspaces/ws-1/invitations/inv-1': { status: 204 },
    });
    renderApp('/people');

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Role of mia@example.com' }), 'Admin');
    await confirmDialog('Make admin');
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke invitation for new@example.com' }));
    await confirmDialog('Revoke');

    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ role: 'Admin' }));
    expect(await screen.findByText('mia@example.com is now an admin')).toBeInTheDocument();
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(await screen.findByText('Revoked the invitation for new@example.com')).toBeInTheDocument();
  });

  it('keeps a role when the change is cancelled', async () => {
    const admin: WorkspaceMember = { ...mia, role: 'Admin' };
    const calls = fakeApi(peopleRoutes('Owner', [kat, admin]));
    renderApp('/people');

    const role = await screen.findByRole('combobox', { name: 'Role of mia@example.com' });
    await userEvent.selectOptions(role, 'Member');
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Make mia@example.com a member?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(role).toHaveValue('Admin');
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('does not let an admin change their own role', async () => {
    const me: WorkspaceMember = { ...mia, userId: 'u-me', email: 'kat@example.com', role: 'Admin' };
    const owner: WorkspaceMember = { ...kat, userId: 'u-leo', email: 'leo@example.com' };
    fakeApi(peopleRoutes('Owner', [owner, me, mia]));
    renderApp('/people');

    const members = within(await screen.findByRole('region', { name: 'Members' }));
    expect(await members.findByRole('combobox', { name: 'Role of mia@example.com' })).toBeInTheDocument();
    expect(members.queryByRole('combobox', { name: 'Role of kat@example.com' })).not.toBeInTheDocument();
  });

  it('shows a member the people without management, and lets them leave', async () => {
    const me: WorkspaceMember = { ...mia, userId: 'u-me', email: 'kat@example.com' };
    const owner: WorkspaceMember = { ...kat, email: 'leo@example.com' };
    const calls = fakeApi({
      ...peopleRoutes('Member', [owner, me]),
      'DELETE /api/v1/workspaces/ws-1/members/u-me': { status: 204 },
    });
    renderApp('/people');

    const ask = await screen.findByRole('link', { name: 'leo@example.com' });
    expect(ask).toHaveAttribute('href', 'mailto:leo@example.com');
    expect(ask.closest('p')).toHaveTextContent('To invite someone, ask leo@example.com.');
    expect(screen.queryByRole('form', { name: 'Invite people' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Role of/ })).not.toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/invitations') && c.path.includes('ws-1'))).toBe(false);

    await userEvent.click(await screen.findByRole('button', { name: 'Leave workspace' }));
    await confirmDialog('Leave workspace');

    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/v1/workspaces/ws-1/members/u-me')).toBe(true));
  });

  it('shows a name over its email, each on one line with the full text on hover', async () => {
    const long = 'ux-collab-member-mv76zqhq@acme-ux.test';
    fakeApi(peopleRoutes('Owner', [kat, { ...mia, name: 'Mia Member', email: long }]));
    renderApp('/people');

    const members = within(await screen.findByRole('region', { name: 'Members' }));
    expect(await members.findByText('Mia Member')).toHaveClass('person-line');
    expect(members.getByText(long)).toHaveAttribute('title', long);
    expect(members.getByText('kat@example.com')).toHaveAttribute('title', 'kat@example.com');
    expect(members.getByRole('button', { name: 'Remove Mia Member' })).toBeInTheDocument();
  });

  it('names every owner and admin a member can ask to invite someone', async () => {
    const admin: WorkspaceMember = { userId: 'u-ada', email: 'ada@example.com', name: 'Ada Admin', role: 'Admin', joinedAt: '2026-10-02T09:00:00Z' };
    fakeApi(peopleRoutes('Member', [{ ...kat, name: 'Kat Owner' }, admin, mia]));
    renderApp('/people');

    const ada = await screen.findByRole('link', { name: 'Ada Admin' });
    expect(ada).toHaveAttribute('href', 'mailto:ada@example.com');
    expect(ada.closest('p')).toHaveTextContent('To invite someone, ask Kat Owner or Ada Admin.');
  });

  it('explains what each role can do', async () => {
    fakeApi(peopleRoutes('Member', [kat, mia]));
    renderApp('/people');

    await userEvent.click(await screen.findByText('What can each role do?'));

    expect(screen.getByText(/hand the workspace to someone else or delete it/)).toBeVisible();
    expect(screen.getByText(/Invite people, answer join requests/)).toBeVisible();
  });

  it('lets the owner hand the workspace to someone else', async () => {
    const calls = fakeApi({
      ...peopleRoutes('Owner', [kat, mia]),
      'POST /api/v1/workspaces/ws-1/transfer': { status: 200, body: aWorkspace({ role: 'Admin' }) },
    });
    renderApp('/people');

    const form = await screen.findByRole('form', { name: 'Transfer ownership' });
    await userEvent.selectOptions(await within(form).findByLabelText('New owner'), 'mia@example.com');
    await userEvent.click(within(form).getByRole('button', { name: 'Transfer ownership' }));
    await confirmDialog('Hand over');

    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/transfer'))?.body).toEqual({ userId: 'u-mia' }));
  });

  it('deletes the workspace only after its name is typed', async () => {
    let deleted = false;
    const calls = fakeApi({
      ...peopleRoutes('Owner', [kat]),
      'GET /api/v1/workspaces': () => ({ status: 200, body: deleted ? [] : [aWorkspace()] }),
      'DELETE /api/v1/workspaces/ws-1': () => {
        deleted = true;
        return { status: 204 };
      },
    });
    const router = renderApp('/people');

    const form = await screen.findByRole('form', { name: 'Delete workspace' });
    const button = within(form).getByRole('button', { name: 'Delete workspace' });
    await userEvent.type(within(form).getByLabelText('Type “Acme Marketing” to confirm'), 'Acme');
    expect(button).toBeDisabled();
    await userEvent.type(within(form).getByLabelText('Type “Acme Marketing” to confirm'), ' Marketing');
    await userEvent.click(button);

    expect(await screen.findByRole('heading', { name: 'Welcome to IdeaVerse' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/v1/workspaces/ws-1')).toBe(true);
  });

  it('hides the danger zone from everyone but the owner', async () => {
    fakeApi(peopleRoutes('Member', [kat, mia]));
    renderApp('/people');

    await screen.findByRole('heading', { name: 'People in Acme Marketing' });
    expect(screen.queryByRole('region', { name: 'Danger zone' })).not.toBeInTheDocument();
  });
});
