import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Notification } from '../api/types';
import { anIdea, fakeApi, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

const tomorrow: Notification = {
  id: 'n-2',
  ideaId: 'idea-1',
  ideaTitle: 'Black Friday teaser',
  kind: 'Tomorrow',
  targetDate: '2026-11-27',
  message: '“Black Friday teaser” is due tomorrow, Fri 27 Nov 2026.',
  createdAt: '2026-11-26T08:00:00Z',
  readAt: null,
};

const comingUp: Notification = {
  ...tomorrow,
  id: 'n-1',
  kind: 'ComingUp',
  message: '“Black Friday teaser” is due in 7 days, on Fri 27 Nov 2026.',
  createdAt: '2026-11-20T08:00:00Z',
  readAt: '2026-11-20T09:00:00Z',
};

function routes(items: Notification[], unreadCount: number) {
  return { ...signedIn, 'GET /api/v1/notifications': { status: 200, body: { items, unreadCount } } };
}

describe('Reminders', () => {
  it('shows the unread count on the header bell', async () => {
    fakeApi({ ...routes([tomorrow, comingUp], 1), 'GET /api/v1/ideas': { status: 200, body: [] } });

    renderApp('/');

    expect(await screen.findByRole('link', { name: 'Reminders, 1 unread' })).toBeInTheDocument();
  });

  it('lists reminders newest first with their stage', async () => {
    fakeApi(routes([tomorrow, comingUp], 1));

    renderApp('/notifications');

    const items = await screen.findAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Tomorrow');
    expect(items[0]).toHaveTextContent('is due tomorrow');
    expect(items[1]).toHaveTextContent('Coming up');
  });

  it('marks one reminder read', async () => {
    const calls = fakeApi({ ...routes([tomorrow], 1), 'POST /api/v1/notifications/n-2/read': { status: 204 } });
    renderApp('/notifications');

    await userEvent.click(await screen.findByRole('button', { name: 'Mark as read' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/api/v1/notifications/n-2/read')).toBe(true));
  });

  it('marks all reminders read', async () => {
    const calls = fakeApi({ ...routes([tomorrow], 1), 'POST /api/v1/notifications/read-all': { status: 204 } });
    renderApp('/notifications');

    await userEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }));

    await waitFor(() => expect(calls.some((c) => c.path === '/api/v1/notifications/read-all')).toBe(true));
  });

  it('opens the idea from a reminder and marks it read', async () => {
    const calls = fakeApi({
      ...routes([tomorrow], 1),
      'POST /api/v1/notifications/n-2/read': { status: 204 },
      'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea() },
      'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
      'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
    });
    const router = renderApp('/notifications');

    await userEvent.click(await screen.findByRole('link', { name: 'Open idea' }));

    expect(await screen.findByRole('heading', { name: 'Black Friday teaser' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ideas/idea-1');
    expect(calls.some((c) => c.path === '/api/v1/notifications/n-2/read')).toBe(true);
  });

  it('explains when there are no reminders yet', async () => {
    fakeApi(routes([], 0));

    renderApp('/notifications');

    expect(await screen.findByText(/No reminders yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
  });
});
