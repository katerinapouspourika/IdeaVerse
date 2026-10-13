import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { aWorkspace, fakeApi, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

function routes(workspace = aWorkspace()) {
  let current = workspace;
  return {
    routes: {
      ...signedIn,
      'GET /api/v1/workspaces': () => ({ status: 200, body: [current] }),
      'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-1/invitations': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-1/invite-link': { status: 200, body: { url: null } },
      'GET /api/v1/workspaces/ws-1/join-requests': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-1/discovery': { status: 200, body: { domain: null, discoverable: false, suggestedDomain: null } },
      'PUT /api/v1/workspaces/ws-1/color': (body: unknown) => {
        current = { ...current, color: (body as { color: string | null }).color };
        return { status: 204 };
      },
      'PUT /api/v1/workspaces/ws-1/logo': () => {
        current = { ...current, logoUpdatedAt: '2026-10-12T10:00:00Z' };
        return { status: 204 };
      },
    },
  };
}

describe('Workspace look', () => {
  it('picks a colour, which the header badge then shows', async () => {
    const calls = fakeApi(routes().routes);
    renderApp('/settings');

    const card = within(await screen.findByRole('region', { name: 'Logo and colour' }));
    await userEvent.click(card.getByRole('radio', { name: 'Teal' }));

    await waitFor(() => expect(card.getByRole('radio', { name: 'Teal' })).toBeChecked());
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ color: 'teal' });
    const badge = within(screen.getByRole('banner')).getByText('A');
    expect(badge).toHaveStyle({ background: '#0f766e' });
  });

  it('uploads a logo and shows it beside the workspace name', async () => {
    const calls = fakeApi(routes().routes);
    renderApp('/settings');

    const card = within(await screen.findByRole('region', { name: 'Logo and colour' }));
    const logo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'logo.png', { type: 'image/png' });
    await userEvent.upload(card.getByLabelText('Upload a logo'), logo);

    expect(await card.findByRole('button', { name: 'Remove logo' })).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PUT' && c.path.endsWith('/logo'))).toBeDefined();
    const images = screen.getByRole('banner').querySelectorAll('img.workspace-badge');
    expect(images[0]).toHaveAttribute('src', '/api/v1/workspaces/ws-1/logo?v=2026-10-12T10%3A00%3A00Z');
  });

  it('refuses a logo over 512 KB without sending it', async () => {
    const calls = fakeApi(routes().routes);
    renderApp('/settings');

    const card = within(await screen.findByRole('region', { name: 'Logo and colour' }));
    const big = new File([new Uint8Array(600 * 1024)], 'big.png', { type: 'image/png' });
    await userEvent.upload(card.getByLabelText('Upload a logo'), big);

    expect(await card.findByText('Choose an image of up to 512 KB.')).toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/logo'))).toBe(false);
  });

  it('sits under the current workspace in Settings for its owners and admins', async () => {
    fakeApi(routes(aWorkspace({ role: 'Admin' })).routes);
    renderApp('/settings');

    const section = await screen.findByRole('region', { name: 'Workspace: Acme Marketing' });
    expect(section).toHaveAttribute('id', 'workspace');
    expect(within(section).getByRole('region', { name: 'Logo and colour' })).toBeInTheDocument();
    expect(within(section).getByText(/beside the workspace’s name at the top of every page/)).toBeInTheDocument();
  });

  it('is left out of Settings for members, who can’t change it', async () => {
    fakeApi(routes(aWorkspace({ role: 'Member' })).routes);
    renderApp('/settings');

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Workspace/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Teal' })).not.toBeInTheDocument();
  });

  it('is linked from the People page rather than shown there', async () => {
    fakeApi(routes().routes);
    const router = renderApp('/people');

    const link = await screen.findByRole('link', { name: 'Logo and colour' });
    expect(screen.queryByRole('radio', { name: 'Teal' })).not.toBeInTheDocument();
    await userEvent.click(link);

    expect(router.state.location.pathname).toBe('/settings');
    expect(router.state.location.hash).toBe('#workspace');
    expect(await screen.findByRole('region', { name: 'Logo and colour' })).toBeInTheDocument();
  });
});
