import { screen, within } from '@testing-library/react';

import { addDays, todayIso } from '../api/dates';
import type { Assignment } from '../api/types';
import { anIdea, fakeApi, ideasRoute, signedIn, signedInAccount } from '../test/fakeApi';
import { renderApp } from '../test/render';

describe('Dashboard', () => {
  it('greets the user and shows what needs attention, their tasks, and their reminders', async () => {
    const today = todayIso();
    const task: Assignment = {
      componentId: 'c-1',
      title: 'Book the venue',
      dueDate: addDays(today, 1),
      ideaId: 'idea-2',
      ideaTitle: 'Team offsite',
      ideaTargetDate: addDays(today, 20),
    };
    fakeApi({
      ...signedIn,
      'GET /api/v1/account': { status: 200, body: { ...signedInAccount, displayName: 'Kat Smith' } },
      [ideasRoute]: {
        status: 200,
        body: [
          anIdea({ id: 'idea-1', title: 'Late launch', targetDate: addDays(today, -2), isOverdue: true }),
          anIdea({ id: 'idea-2', title: 'Team offsite', targetDate: addDays(today, 3), status: 'InProgress' }),
          anIdea({ id: 'idea-3', title: 'Far away', targetDate: addDays(today, 60) }),
          anIdea({ id: 'idea-4', title: 'Shipped', targetDate: addDays(today, -5), status: 'Done' }),
        ],
      },
      'GET /api/v1/workspaces/ws-1/assignments': { status: 200, body: [task] },
      'GET /api/v1/notifications': {
        status: 200,
        body: {
          items: [
            {
              id: 'n-1',
              ideaId: 'idea-1',
              ideaTitle: 'Late launch',
              kind: 'Overdue',
              targetDate: addDays(today, -2),
              message: '“Late launch” is overdue',
              createdAt: '2026-10-01T08:00:00Z',
              readAt: null,
            },
          ],
          unreadCount: 1,
        },
      },
    });
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: /, Kat$/ })).toBeInTheDocument();
    await screen.findByText('Late launch');
    const stats = screen.getByRole('region', { name: 'At a glance' });
    expect(within(stats).getByText('Overdue').previousSibling).toHaveTextContent('1');
    expect(within(stats).getByText('Due this week').previousSibling).toHaveTextContent('1');
    expect(within(stats).getByText('In progress').previousSibling).toHaveTextContent('1');
    expect(within(stats).getByText('Done').previousSibling).toHaveTextContent('1');

    const attention = screen.getByRole('region', { name: 'Needs attention' });
    expect(within(attention).getAllByRole('link').map((l) => l.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Late launch'), expect.stringContaining('Team offsite')]),
    );
    expect(within(attention).queryByText('Far away')).not.toBeInTheDocument();

    const tasks = screen.getByRole('region', { name: 'Your tasks' });
    expect(within(tasks).getByRole('link', { name: /Book the venue/ })).toHaveAttribute('href', '/ideas/idea-2');
    expect(within(tasks).getByText('due tomorrow')).toBeInTheDocument();

    expect(within(screen.getByRole('region', { name: 'Latest reminders' })).getByRole('link', { name: '“Late launch” is overdue' })).toBeInTheDocument();
  });

  it('celebrates when nothing needs attention', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [anIdea()] } });
    renderApp('/');

    expect(await screen.findByText(/Nothing overdue or due this week/)).toBeInTheDocument();
    expect(screen.getByText('You’re all caught up. Time to capture a new idea?')).toBeInTheDocument();
  });
});
