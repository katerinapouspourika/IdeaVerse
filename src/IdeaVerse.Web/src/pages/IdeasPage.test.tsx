import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { anIdea, fakeApi, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

describe('IdeasPage', () => {
  it('lists ideas with their status, overdue flag, progress, and sharing', async () => {
    fakeApi({
      ...signedIn,
      'GET /api/v1/ideas': {
        status: 200,
        body: [
          anIdea({ id: 'a', title: 'Spring launch', targetDate: '2020-03-01', isOverdue: true, componentCount: 4, completedComponentCount: 1 }),
          anIdea({ id: 'b', title: 'Podcast', status: 'Postponed', postponeCount: 2, role: 'Member' }),
        ],
      },
    });

    renderApp('/');

    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]!).getByText('Spring launch')).toBeInTheDocument();
    expect(within(items[0]!).getByText('Overdue')).toBeInTheDocument();
    expect(within(items[0]!).getByText('1/4 ready')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Postponed')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Shared with you')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Postponed 2×')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 overdue');
  });

  it('shows an empty state when there are no ideas', async () => {
    fakeApi({ ...signedIn, 'GET /api/v1/ideas': { status: 200, body: [] } });

    renderApp('/');

    expect(await screen.findByText(/No ideas yet/)).toBeInTheDocument();
  });

  it('filters by status through the API', async () => {
    const calls = fakeApi({
      ...signedIn,
      'GET /api/v1/ideas': { status: 200, body: [anIdea()] },
      'GET /api/v1/ideas?status=Done': { status: 200, body: [] },
    });
    renderApp('/');
    await screen.findByText('Black Friday teaser');

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findByText('No ideas with this status.')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/api/v1/ideas?status=Done')).toBe(true);
  });

  it('creates an idea and shows the API validation message for a bad date', async () => {
    const calls = fakeApi({
      ...signedIn,
      'GET /api/v1/ideas': { status: 200, body: [] },
      'POST /api/v1/ideas': { status: 400, body: { errors: { targetDate: ['The target date cannot be in the past.'] } } },
    });
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'New idea' }));

    const form = screen.getByRole('form', { name: 'New idea' });
    await userEvent.type(within(form).getByLabelText('Title'), 'Webinar series');
    await userEvent.click(within(form).getByRole('button', { name: 'Add idea' }));

    expect(await within(form).findByText('The target date cannot be in the past.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ title: 'Webinar series', description: null });
  });
});
