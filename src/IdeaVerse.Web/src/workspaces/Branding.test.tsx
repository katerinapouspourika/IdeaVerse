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
    renderApp('/people');

    const card = within(await screen.findByRole('region', { name: 'Look' }));
    await userEvent.click(card.getByRole('radio', { name: 'Teal' }));

    await waitFor(() => expect(card.getByRole('radio', { name: 'Teal' })).toBeChecked());
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ color: 'teal' });
    const badge = within(screen.getByRole('banner')).getByText('A');
    expect(badge).toHaveStyle({ background: '#0f766e' });
  });

  it('uploads a logo and shows it beside the workspace name', async () => {
    const calls = fakeApi(routes().routes);
    renderApp('/people');

    const card = within(await screen.findByRole('region', { name: 'Look' }));
    const logo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'logo.png', { type: 'image/png' });
    await userEvent.upload(card.getByLabelText('Upload a logo'), logo);

    expect(await card.findByRole('button', { name: 'Remove logo' })).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PUT' && c.path.endsWith('/logo'))).toBeDefined();
    const images = screen.getByRole('banner').querySelectorAll('img.workspace-badge');
    expect(images[0]).toHaveAttribute('src', '/api/v1/workspaces/ws-1/logo?v=2026-10-12T10%3A00%3A00Z');
  });

  it('refuses a logo over 512 KB without sending it', async () => {
    const calls = fakeApi(routes().routes);
    renderApp('/people');

    const card = within(await screen.findByRole('region', { name: 'Look' }));
    const big = new File([new Uint8Array(600 * 1024)], 'big.png', { type: 'image/png' });
    await userEvent.upload(card.getByLabelText('Upload a logo'), big);

    expect(await card.findByText('Choose an image of up to 512 KB.')).toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/logo'))).toBe(false);
  });
});
