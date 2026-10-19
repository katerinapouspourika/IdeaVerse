import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { WorkspaceMember } from '../api/types';
import { aWorkspace, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { confirmDialog } from '../test/dialog';
import { renderApp } from '../test/render';

const kat: WorkspaceMember = { userId: 'u-kat', email: 'kat@example.com', name: null, role: 'Owner', joinedAt: '2026-10-01T09:00:00Z' };
const mia: WorkspaceMember = { userId: 'u-mia', email: 'mia@example.com', name: null, role: 'Member', joinedAt: '2026-10-02T09:00:00Z' };

function settingsRoutes(role: 'Owner' | 'Admin' | 'Member', members: WorkspaceMember[]) {
  return {
    ...signedIn,
    'GET /api/v1/workspaces': { status: 200, body: [aWorkspace({ role, memberCount: members.length })] },
    'GET /api/v1/workspaces/ws-1/members': { status: 200, body: members },
    'GET /api/v1/workspaces/ws-1/invite-link': { status: 200, body: { url: null } },
    'GET /api/v1/workspaces/ws-1/discovery': { status: 200, body: { domain: null, discoverable: false, suggestedDomain: 'example.com' } },
    [ideasRoute]: { status: 200, body: [] },
  };
}

describe('WorkspaceSettingsPage', () => {
  it('holds the name, look, invite link and company domain together', async () => {
    fakeApi(settingsRoutes('Owner', [kat]));
    renderApp('/workspace/settings');

    expect(await screen.findByRole('heading', { name: 'Workspace settings', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Rename workspace' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Logo and colour' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Invite link' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Company domain' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Danger zone' })).toBeInTheDocument();
  });

  it('renames the workspace', async () => {
    const calls = fakeApi({
      ...settingsRoutes('Admin', [kat]),
      'PUT /api/v1/workspaces/ws-1': (body) => ({ status: 200, body: aWorkspace({ ...(body as object), role: 'Admin' }) }),
    });
    renderApp('/workspace/settings');

    const form = await screen.findByRole('form', { name: 'Rename workspace' });
    const save = within(form).getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await userEvent.clear(within(form).getByLabelText('Workspace name'));
    await userEvent.type(within(form).getByLabelText('Workspace name'), 'Acme Growth');
    await userEvent.click(save);

    expect(await within(form).findByRole('status')).toHaveTextContent('Saved.');
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ name: 'Acme Growth' });

    await userEvent.type(within(form).getByLabelText('Workspace name'), ' Team');
    expect(within(form).queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the danger zone to the owner only', async () => {
    fakeApi(settingsRoutes('Admin', [kat, mia]));
    renderApp('/workspace/settings');

    expect(await screen.findByRole('region', { name: 'Logo and colour' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Danger zone' })).not.toBeInTheDocument();
  });

  it('tells a member who can change the settings, without the forms', async () => {
    const calls = fakeApi(settingsRoutes('Member', [kat, mia]));
    renderApp('/workspace/settings');

    expect(await screen.findByText(/Only the workspace’s owner and admins can change/)).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'People' })).toHaveAttribute('href', '/people');
    expect(screen.queryByRole('form', { name: 'Rename workspace' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/invite-link') || c.path.endsWith('/discovery'))).toBe(false);
  });

  it('lets the owner hand the workspace to someone else', async () => {
    const calls = fakeApi({
      ...settingsRoutes('Owner', [kat, mia]),
      'POST /api/v1/workspaces/ws-1/transfer': { status: 200, body: aWorkspace({ role: 'Admin' }) },
    });
    renderApp('/workspace/settings');

    const form = await screen.findByRole('form', { name: 'Transfer ownership' });
    await userEvent.selectOptions(await within(form).findByLabelText('New owner'), 'mia@example.com');
    await userEvent.click(within(form).getByRole('button', { name: 'Transfer ownership' }));
    await confirmDialog('Hand over');

    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/transfer'))?.body).toEqual({ userId: 'u-mia' }));
  });

  it('deletes the workspace only after its name is typed', async () => {
    let deleted = false;
    const calls = fakeApi({
      ...settingsRoutes('Owner', [kat]),
      'GET /api/v1/workspaces': () => ({ status: 200, body: deleted ? [] : [aWorkspace()] }),
      'DELETE /api/v1/workspaces/ws-1': () => {
        deleted = true;
        return { status: 204 };
      },
    });
    const router = renderApp('/workspace/settings');

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

});
