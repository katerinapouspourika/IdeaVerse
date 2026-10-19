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
    expect(await members.findByRole('combobox', { name: 'Role of mia@example.com' })).toHaveValue('Member');
    expect(within(members.getByText('kat@example.com').closest('li')!).getByText('Owner')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Pending invitations' })).getByText('new@example.com')).toBeInTheDocument();
  });

  it('lets an admin invite someone by email and role', async () => {
    const calls = fakeApi({
      ...peopleRoutes('Owner', [kat]),
      'POST /api/v1/workspaces/ws-1/invitations': (body) => ({ status: 201, body: { ...pending, ...(body as object) } }),
    });
    renderApp('/people');

    const form = await screen.findByRole('form', { name: 'Invite people' });
    await userEvent.type(within(form).getByLabelText('Email addresses'), 'leo@example.com');
    await userEvent.selectOptions(within(form).getByLabelText('Role'), 'Admin');
    await userEvent.click(within(form).getByRole('button', { name: 'Send invitation' }));

    expect(await within(form).findByRole('status')).toHaveTextContent('Invitation sent to leo@example.com.');
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ email: 'leo@example.com', role: 'Admin' });
  });

  it('turns a pasted list into chips, flags the ones it can’t invite, and sends the rest with one role', async () => {
    const calls = fakeApi({
      ...peopleRoutes('Owner', [kat, mia]),
      'POST /api/v1/workspaces/ws-1/invitations': (body) => ({ status: 201, body: { ...pending, ...(body as object) } }),
    });
    renderApp('/people');

    const form = await screen.findByRole('form', { name: 'Invite people' });
    const box = within(form).getByLabelText('Email addresses');
    await userEvent.click(box);
    await userEvent.paste('leo@example.com, Ada <ada@example.com>; not-an-email\nMIA@example.com new@example.com leo@example.com');

    const chips = within(within(form).getByRole('list', { name: 'Addresses to invite' }));
    expect(chips.getAllByRole('listitem').map((chip) => chip.firstChild?.textContent)).toEqual([
      'leo@example.com',
      'ada@example.com',
      'not-an-email',
      'MIA@example.com',
      'new@example.com',
    ]);
    // A long address is cut short on screen, so the chip carries it whole on hover, with any problem.
    expect(chips.getAllByRole('listitem')[0]).toHaveAttribute('title', 'leo@example.com');
    expect(chips.getAllByRole('listitem')[2]).toHaveAttribute('title', 'not-an-email — Not a valid email address.');
    expect(within(form).getByRole('note')).toHaveTextContent('Already in the list, so left out: leo@example.com.');
    const problems = within(within(form).getByRole('list', { name: 'Addresses not invited' }));
    expect(problems.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'not-an-email — Not a valid email address.',
      'MIA@example.com — Already in the workspace.',
      'new@example.com — Already invited. Resend it from Pending invitations.',
    ]);

    await userEvent.selectOptions(within(form).getByLabelText('Role'), 'Admin');
    await userEvent.click(within(form).getByRole('button', { name: 'Send 2 invitations' }));

    expect(await within(form).findByRole('status')).toHaveTextContent('2 invitations sent: leo@example.com, ada@example.com.');
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.body)).toEqual([
      { email: 'leo@example.com', role: 'Admin' },
      { email: 'ada@example.com', role: 'Admin' },
    ]);
    expect(chips.queryByText('leo@example.com')).not.toBeInTheDocument();
    expect(chips.getByText('not-an-email')).toBeInTheDocument();
  });

  it('adds an address as a chip after a comma, and removes a chip', async () => {
    fakeApi(peopleRoutes('Owner', [kat]));
    renderApp('/people');

    const form = await screen.findByRole('form', { name: 'Invite people' });
    const box = within(form).getByLabelText('Email addresses');
    await userEvent.type(box, 'leo@example.com,ada@exa');

    expect(within(form).getByRole('list', { name: 'Addresses to invite' })).toHaveTextContent('leo@example.com');
    expect(box).toHaveValue('ada@exa');
    await userEvent.click(within(form).getByRole('button', { name: 'Remove leo@example.com' }));

    // Leaving the box turns what was typed into a chip too, marked until it is a whole address.
    const chips = within(form).getByRole('list', { name: 'Addresses to invite' });
    expect(chips).not.toHaveTextContent('leo@example.com');
    expect(within(form).getByRole('list', { name: 'Addresses not invited' })).toHaveTextContent('ada@exa — Not a valid email address.');
  });

  it('reports which addresses the API refused, and keeps them', async () => {
    fakeApi({
      ...peopleRoutes('Owner', [kat]),
      'POST /api/v1/workspaces/ws-1/invitations': (body) =>
        (body as { email: string }).email === 'old@example.com'
          ? { status: 409, body: { detail: 'old@example.com already has an open invitation. Resend it from Pending invitations on the People page.' } }
          : { status: 201, body: { ...pending, ...(body as object) } },
    });
    renderApp('/people');

    const form = await screen.findByRole('form', { name: 'Invite people' });
    await userEvent.click(within(form).getByLabelText('Email addresses'));
    await userEvent.paste('old@example.com leo@example.com');
    await userEvent.click(within(form).getByRole('button', { name: 'Send 2 invitations' }));

    expect(await within(form).findByRole('status')).toHaveTextContent('Invitation sent to leo@example.com.');
    const problems = within(within(form).getByRole('list', { name: 'Addresses not invited' }));
    expect(problems.getByRole('listitem')).toHaveTextContent(/^old@example.com — old@example.com already has an open invitation/);
    expect(within(form).getByRole('list', { name: 'Addresses to invite' })).toHaveTextContent('old@example.com');
  });

  it('sends nothing when every address has a problem', async () => {
    const calls = fakeApi(peopleRoutes('Owner', [kat, mia]));
    renderApp('/people');

    const form = await screen.findByRole('form', { name: 'Invite people' });
    await userEvent.type(within(form).getByLabelText('Email addresses'), 'mia@example.com');
    await userEvent.click(within(form).getByRole('button', { name: 'Send invitation' }));

    expect(within(form).getByLabelText('Email addresses')).toHaveAccessibleDescription(expect.stringContaining('None of these addresses can be invited yet'));
    expect(within(form).getByText('Already in the workspace.', { exact: false })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
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
    expect(screen.queryByRole('link', { name: 'Workspace settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Role of/ })).not.toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/invitations') && c.path.includes('ws-1'))).toBe(false);

    await userEvent.click(await screen.findByRole('button', { name: 'Leave workspace' }));
    await confirmDialog('Leave workspace');

    expect(await screen.findByText('You left Acme Marketing')).toBeInTheDocument();
    // Nothing asks about the workspace once left; it would only be refused.
    const leftAt = calls.findIndex((c) => c.method === 'DELETE' && c.path === '/api/v1/workspaces/ws-1/members/u-me');
    expect(leftAt).toBeGreaterThan(-1);
    expect(calls.slice(leftAt + 1).filter((c) => c.path.startsWith('/api/v1/workspaces/ws-1') || c.path.includes('workspaceId=ws-1'))).toEqual([]);
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

  it('opens on the workspace an email links to', async () => {
    fakeApi({
      ...peopleRoutes('Owner', [kat]),
      'GET /api/v1/workspaces': { status: 200, body: [aWorkspace(), aWorkspace({ id: 'ws-2', name: 'Globex', role: 'Admin' })] },
      'GET /api/v1/workspaces/ws-2/members': { status: 200, body: [kat] },
      'GET /api/v1/workspaces/ws-2/invitations': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-2/join-requests': { status: 200, body: [] },
    });
    const router = renderApp('/people?workspace=ws-2');

    expect(await screen.findByRole('heading', { name: 'People in Globex' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Workspace: Globex' })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('marks the phone menu when invitations are waiting inside it', async () => {
    fakeApi({
      ...peopleRoutes('Member', [kat, mia]),
      'GET /api/v1/invitations': {
        status: 200,
        body: [{ id: 'inv-9', workspaceId: 'ws-2', workspaceName: 'Globex', role: 'Member', invitedByEmail: 'leo@example.com', invitedByName: null, expiresAt: '2099-01-08T09:00:00Z' }],
      },
    });
    renderApp('/people');

    expect(await screen.findByRole('button', { name: 'Menu, 1 waiting' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Invitations (1)' })).toBeInTheDocument();
  });

  it('keeps to people, linking to the workspace’s settings', async () => {
    fakeApi(peopleRoutes('Owner', [kat, mia]));
    const router = renderApp('/people');

    const link = await screen.findByRole('link', { name: 'Workspace settings' });
    expect(screen.queryByRole('region', { name: 'Danger zone' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Invite link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Company domain' })).not.toBeInTheDocument();
    await userEvent.click(link);

    expect(await screen.findByRole('heading', { name: 'Workspace settings', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/workspace/settings');
  });
});
