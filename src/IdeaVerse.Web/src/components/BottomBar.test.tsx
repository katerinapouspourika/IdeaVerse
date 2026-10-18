import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { fakeApi, ideasRoute, signedIn, signedOut } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { phoneQuery } from './useMediaQuery';

/** Makes the window phone-sized, as far as the app's media queries can tell. */
function onAPhone() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === phoneQuery,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('Bottom bar on a phone', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('links the app’s main pages, marks the current one, and replaces the footer', async () => {
    onAPhone();
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/ideas');

    const bar = within(await screen.findByRole('navigation', { name: 'Sections' }));
    expect(bar.getAllByRole('link').map((link) => link.getAttribute('aria-label') ?? link.textContent)).toEqual([
      'Home',
      'Ideas',
      'New idea',
      'Notifications',
      'People',
    ]);
    expect(bar.getByRole('link', { name: 'Ideas' })).toHaveAttribute('aria-current', 'page');
    expect(bar.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(bar.getByRole('link', { name: 'New idea' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();

    // The header names the workspace and leaves the bar's links and the bell out of its own.
    expect(within(screen.getByRole('banner')).getByText('Workspace:').parentElement).toHaveTextContent('Workspace: Acme Marketing');
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
    const menu = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(menu.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    expect(menu.queryByRole('link', { name: 'Ideas' })).not.toBeInTheDocument();
    expect(menu.queryByRole('link', { name: 'People' })).not.toBeInTheDocument();
    expect(menu.getByLabelText(/^Workspace/)).toBeInTheDocument();

    await userEvent.click(bar.getByRole('link', { name: 'People' }));
    await waitFor(() => expect(bar.getByRole('link', { name: 'People' })).toHaveAttribute('aria-current', 'page'));
  });

  it('counts unread notifications and requests to join on their links', async () => {
    onAPhone();
    fakeApi({
      ...signedIn,
      'GET /api/v1/notifications': { status: 200, body: { items: [], unreadCount: 3 } },
      'GET /api/v1/workspaces/ws-1/join-requests': {
        status: 200,
        body: [{ id: 'r-1', email: 'mia@acme.com', name: 'Mia Chen', createdAt: '2026-10-11T09:00:00Z' }],
      },
      [ideasRoute]: { status: 200, body: [] },
    });
    renderApp('/ideas');

    const bar = within(await screen.findByRole('navigation', { name: 'Sections' }));
    expect(await bar.findByRole('link', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
    expect(await bar.findByRole('link', { name: 'People, 1 asking to join' })).toBeInTheDocument();
    // The menu no longer holds People, so its button doesn't count the request again.
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
  });

  it('opens the New idea form', async () => {
    onAPhone();
    fakeApi({ ...signedIn, 'GET /api/v1/workspaces/ws-1/dashboard': { status: 404 }, [ideasRoute]: { status: 200, body: [] } });
    const router = renderApp('/notifications');

    await userEvent.click(within(await screen.findByRole('navigation', { name: 'Sections' })).getByRole('link', { name: 'New idea' }));

    expect(await screen.findByRole('form', { name: 'New idea' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ideas');
  });

  it('is left out of public pages, which keep their footer', async () => {
    onAPhone();
    fakeApi(signedOut);
    renderApp('/pricing');

    expect(await screen.findByRole('contentinfo')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument();
  });

  it('waits for a workspace, keeping the header’s links until then', async () => {
    onAPhone();
    fakeApi({ ...signedIn, 'GET /api/v1/workspaces': { status: 200, body: [] } });
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Welcome to IdeaVerse' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument();
  });

  it('is not shown on wider screens', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/ideas');

    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument();
  });
});
