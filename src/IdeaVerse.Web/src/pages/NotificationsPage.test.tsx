import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { todayIso } from '../api/dates';
import type { Comment, Component, Notification } from '../api/types';
import { aWorkspace, anIdea, fakeApi, ideasRoute, signedIn, signedInAccount } from '../test/fakeApi';
import { renderApp } from '../test/render';

const tomorrow: Notification = {
  id: 'n-2',
  ideaId: 'idea-1',
  ideaTitle: 'Black Friday teaser',
  workspaceId: 'ws-1',
  workspaceName: 'Acme Marketing',
  kind: 'Tomorrow',
  targetDate: '2026-11-27',
  message: 'The target date for “Black Friday teaser” is tomorrow, Fri 27 Nov 2026.',
  createdAt: '2026-11-26T08:00:00Z',
  readAt: null,
  commentId: null,
  componentId: null,
  componentTitle: null,
};

const comingUp: Notification = {
  ...tomorrow,
  id: 'n-1',
  kind: 'ComingUp',
  message: 'The target date for “Black Friday teaser” is in 7 days, on Fri 27 Nov 2026.',
  createdAt: '2026-11-20T08:00:00Z',
  readAt: '2026-11-20T09:00:00Z',
};

function routes(items: Notification[], unreadCount: number) {
  return { ...signedIn, 'GET /api/v1/notifications': { status: 200, body: { items, unreadCount } } };
}

const aComment: Comment = {
  id: 'c-1',
  body: 'First thoughts',
  authorEmail: 'mia@example.com',
  authorName: 'Mia',
  createdAt: '2026-11-25T08:00:00Z',
  editedAt: null,
  canEdit: false,
  canDelete: false,
};

const aComponent: Component = {
  id: 'k-1',
  title: 'Budget',
  notes: null,
  isDone: false,
  position: 0,
  createdAt: '2026-11-01T08:00:00Z',
  completedAt: null,
  assigneeId: null,
  assigneeEmail: null,
  assigneeName: null,
  dueDate: null,
};

/** The idea page's routes for idea-1, with its comments and components. */
function ideaRoutes(comments: Comment[], components: Component[]) {
  return {
    'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea() },
    'GET /api/v1/ideas/idea-1/components': { status: 200, body: components },
    'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
    'GET /api/v1/ideas/idea-1/comments': { status: 200, body: comments },
    'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
  };
}

describe('Notifications', () => {
  it('shows the unread count on the header bell and previews the latest', async () => {
    fakeApi({ ...routes([tomorrow, comingUp], 1), [ideasRoute]: { status: 200, body: [] } });

    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const preview = screen.getByRole('region', { name: 'Latest notifications' });
    expect(within(preview).getAllByRole('link')[0]).toHaveTextContent('Due tomorrow');
    expect(within(preview).getByRole('link', { name: 'See all 2 notifications' })).toHaveAttribute('href', '/notifications');
  });

  it('previews each notification with a short title, its idea, how long ago, and whether it is unread', async () => {
    const recent = { ...tomorrow, kind: 'Mentioned' as const, createdAt: new Date(Date.now() - 5 * 60_000).toISOString() };
    fakeApi({ ...routes([recent, comingUp], 1), [ideasRoute]: { status: 200, body: [] } });

    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const [unread, read] = within(screen.getByRole('region', { name: 'Latest notifications' })).getAllByRole('link');
    const link = unread!;
    expect(link).toHaveAccessibleName('You were mentioned, unread: Black Friday teaser, 5 min ago');
    expect(link).toHaveAttribute('title', recent.message);
    expect(read).toHaveAccessibleName(/^Coming up: Black Friday teaser, /);
  });

  it('names the component a notification is about in the drop-down', async () => {
    const due = { ...tomorrow, id: 'n-3', componentId: 'k-1', componentTitle: 'Book the venue', message: '“Book the venue” for “Black Friday teaser” is due tomorrow.' };
    fakeApi({ ...routes([due, tomorrow], 2), [ideasRoute]: { status: 200, body: [] } });

    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
    const [component, idea] = within(screen.getByRole('region', { name: 'Latest notifications' })).getAllByRole('link');
    expect(component).toHaveTextContent('Book the venue · Black Friday teaser');
    expect(component).toHaveAccessibleName(/^Due tomorrow, unread: Book the venue for Black Friday teaser, /);
    expect(idea).toHaveAccessibleName(/^Due tomorrow, unread: Black Friday teaser, /);
  });

  it('marks all read from the drop-down', async () => {
    const calls = fakeApi({ ...routes([tomorrow], 1), [ideasRoute]: { status: 200, body: [] }, 'POST /api/v1/notifications/read-all': { status: 204 } });
    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await userEvent.click(within(screen.getByRole('region', { name: 'Latest notifications' })).getByRole('button', { name: 'Mark all as read' }));

    await waitFor(() => expect(calls.some((c) => c.path === '/api/v1/notifications/read-all')).toBe(true));
  });

  it('moves through the drop-down with the keyboard and closes it with Escape, back on the bell', async () => {
    fakeApi({ ...routes([tomorrow, comingUp], 1), [ideasRoute]: { status: 200, body: [] } });
    renderApp('/');
    const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' });

    bell.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getAllByRole('link', { name: /Due tomorrow/ })[0]).toHaveFocus();
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('region', { name: 'Latest notifications' })).not.toBeInTheDocument();
    expect(bell).toHaveFocus();
  });

  it('lists reminders newest first with their stage', async () => {
    fakeApi(routes([tomorrow, comingUp], 1));

    renderApp('/notifications');

    const items = await within(screen.getByRole('main')).findAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Tomorrow');
    expect(items[0]).toHaveTextContent('is tomorrow');
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

  it('filters to unread notifications and to mentions, keeping the choice in the address', async () => {
    const mention: Notification = { ...tomorrow, id: 'n-3', kind: 'Mentioned', message: 'Mia mentioned you on “Black Friday teaser”.', readAt: '2026-11-26T09:00:00Z' };
    fakeApi(routes([tomorrow, mention, comingUp], 1));
    const router = renderApp('/notifications');
    const main = screen.getByRole('main');
    expect(await within(main).findAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Unread' }));
    expect(within(main).getAllByRole('listitem')).toHaveLength(1);
    expect(within(main).getByRole('listitem')).toHaveTextContent('is tomorrow');
    expect(screen.getByRole('button', { name: 'Unread' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Mentions' }));
    expect(within(main).getAllByRole('listitem')).toHaveLength(1);
    expect(within(main).getByRole('listitem')).toHaveTextContent('Mia mentioned you');
    expect(router.state.location.search).toBe('?show=mentions');
  });

  it('says so when a filter leaves nothing to show', async () => {
    fakeApi(routes([comingUp], 0));

    renderApp('/notifications?show=mentions');

    expect(await screen.findByText(/No mentions yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mentions' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('groups notifications under Today and Earlier by the account’s own date', async () => {
    // Just after midnight in Kiritimati (UTC+14), which is still the day before in UTC.
    const today = todayIso(new Date(), 'Pacific/Kiritimati');
    const justAfterMidnight = new Date(`${today}T00:01:00+14:00`);
    const fresh = { ...tomorrow, createdAt: justAfterMidnight.toISOString(), message: 'Fresh one' };
    const lastNight = { ...comingUp, createdAt: new Date(justAfterMidnight.getTime() - 60 * 60_000).toISOString(), message: 'Last night' };
    fakeApi({
      ...routes([fresh, lastNight], 1),
      'GET /api/v1/account': { status: 200, body: { ...signedInAccount, timeZone: 'Pacific/Kiritimati' } },
    });

    renderApp('/notifications');

    const todays = await screen.findByRole('region', { name: 'Today' });
    expect(within(todays).getByRole('listitem')).toHaveTextContent('Fresh one');
    expect(within(screen.getByRole('region', { name: 'Earlier' })).getByRole('listitem')).toHaveTextContent('Last night');
  });

  it('opens a mention at its comment, focused and highlighted', async () => {
    const mention: Notification = { ...tomorrow, kind: 'Mentioned', message: 'Mia mentioned you on “Black Friday teaser”.', commentId: 'c-2' };
    const reply: Comment = { ...aComment, id: 'c-2', body: 'Over to you' };
    fakeApi({ ...routes([mention], 1), ...ideaRoutes([aComment, reply], []), 'POST /api/v1/notifications/n-2/read': { status: 204 } });
    const router = renderApp('/notifications');

    await userEvent.click(await screen.findByRole('link', { name: 'Open idea' }));

    const discussion = await screen.findByRole('region', { name: 'Discussion' });
    const target = (await within(discussion).findAllByRole('listitem'))[1];
    await waitFor(() => expect(target).toHaveFocus());
    expect(target).toHaveTextContent('Over to you');
    expect(target).toHaveClass('linked');
    expect(router.state.location.hash).toBe('#comment-c-2');
  });

  it('opens an assignment at its component', async () => {
    const assigned: Notification = { ...tomorrow, kind: 'Assigned', message: 'Mia assigned “Budget” to you.', componentId: 'k-1', componentTitle: 'Budget' };
    fakeApi({ ...routes([assigned], 1), ...ideaRoutes([], [aComponent]), 'POST /api/v1/notifications/n-2/read': { status: 204 } });
    renderApp('/notifications');

    await userEvent.click(await screen.findByRole('link', { name: 'Open idea' }));

    const checklist = await screen.findByRole('region', { name: 'What it needs' });
    const target = await within(checklist).findByRole('listitem');
    await waitFor(() => expect(target).toHaveFocus());
    expect(target).toHaveTextContent('Budget');
  });

  it('just opens the idea when what a notification points at is gone', async () => {
    fakeApi({ ...routes([], 0), ...ideaRoutes([aComment], []) });

    renderApp('/ideas/idea-1#comment-deleted');

    const discussion = await screen.findByRole('region', { name: 'Discussion' });
    const comment = await within(discussion).findByRole('listitem');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(comment).not.toHaveFocus();
    expect(comment).not.toHaveClass('linked');
  });

  it('opens a countdown at the top of the idea', async () => {
    fakeApi(routes([tomorrow], 1));

    renderApp('/notifications');

    expect(await screen.findByRole('link', { name: 'Open idea' })).toHaveAttribute('href', '/ideas/idea-1');
  });

  it('names each notification’s workspace for someone in several', async () => {
    const globex = { ...tomorrow, id: 'n-3', workspaceId: 'ws-2', workspaceName: 'Globex', message: 'Globex launch is tomorrow.' };
    fakeApi({
      ...routes([globex, tomorrow], 2),
      'GET /api/v1/workspaces': { status: 200, body: [aWorkspace(), aWorkspace({ id: 'ws-2', name: 'Globex', role: 'Member' })] },
      [ideasRoute]: { status: 200, body: [] },
    });

    renderApp('/notifications');

    const items = await within(screen.getByRole('main')).findAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Globex');
    expect(items[1]).toHaveTextContent('Acme Marketing');

    await userEvent.click(screen.getByRole('button', { name: 'Notifications, 2 unread' }));
    const preview = screen.getByRole('region', { name: 'Latest notifications' });
    expect(within(preview).getAllByRole('listitem')[0]).toHaveTextContent('Globex');
  });

  it('leaves the workspace out for someone in one', async () => {
    fakeApi(routes([tomorrow], 1));

    renderApp('/notifications');

    const items = await within(screen.getByRole('main')).findAllByRole('listitem');
    expect(items[0]).not.toHaveTextContent('Acme Marketing');
  });

  it('says so when opening a notification switches the workspace', async () => {
    const globex = aWorkspace({ id: 'ws-2', name: 'Globex', role: 'Member' });
    fakeApi({
      ...routes([{ ...tomorrow, ideaId: 'idea-2', workspaceId: 'ws-2', workspaceName: 'Globex' }], 1),
      'GET /api/v1/workspaces': { status: 200, body: [aWorkspace(), globex] },
      'POST /api/v1/notifications/n-2/read': { status: 204 },
      'GET /api/v1/ideas/idea-2': { status: 200, body: anIdea({ id: 'idea-2', workspaceId: 'ws-2' }) },
      'GET /api/v1/ideas/idea-2/components': { status: 200, body: [] },
      'GET /api/v1/ideas/idea-2/members': { status: 200, body: [] },
    });
    renderApp('/notifications');

    await userEvent.click(await screen.findByRole('link', { name: 'Open idea' }));

    expect(await screen.findByText('Switched to Globex')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Workspace: Globex' })).toBeInTheDocument();
  });

  it('links the reminder settings', async () => {
    fakeApi(routes([], 0));

    renderApp('/notifications');

    expect(await screen.findByRole('link', { name: 'Settings → Reminders' })).toHaveAttribute('href', '/settings#reminders');
  });

  it('shows when each arrived in the account’s time zone', async () => {
    fakeApi({
      ...routes([tomorrow], 1),
      'GET /api/v1/account': { status: 200, body: { ...signedInAccount, timeZone: 'Pacific/Kiritimati' } },
    });

    renderApp('/notifications');

    // 08:00 UTC on 26 Nov is 22:00 the same day in Kiritimati (UTC+14).
    const time = await screen.findByText(/26 Nov 2026|Nov 26, 2026/);
    expect(time).toHaveAttribute('datetime', tomorrow.createdAt);
    expect(time.textContent).toMatch(/22:00|10:00\s?PM/);
  });

  it('explains when there are no notifications yet', async () => {
    fakeApi(routes([], 0));

    renderApp('/notifications');

    expect(await screen.findByText(/Reminders and updates about your ideas appear here/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
  });

  it('shows the unread count on the app icon, and clears it once all are read', async () => {
    const setAppBadge = vi.fn(() => Promise.resolve());
    const clearAppBadge = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { setAppBadge, clearAppBadge });
    let unread = 1;
    fakeApi({
      ...signedIn,
      'GET /api/v1/notifications': () => ({ status: 200, body: { items: unread ? [tomorrow] : [{ ...tomorrow, readAt: '2026-11-26T09:00:00Z' }], unreadCount: unread } }),
      'POST /api/v1/notifications/read-all': () => {
        unread = 0;
        return { status: 204 };
      },
    });

    try {
      renderApp('/notifications');
      await waitFor(() => expect(setAppBadge).toHaveBeenCalledWith(1));

      await userEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }));
      await waitFor(() => expect(clearAppBadge).toHaveBeenCalled());
      expect(setAppBadge).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
      Reflect.deleteProperty(navigator, 'setAppBadge');
      Reflect.deleteProperty(navigator, 'clearAppBadge');
    }
  });
});
