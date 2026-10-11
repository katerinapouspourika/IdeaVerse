import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { addDays, todayIso } from '../api/dates';
import { anIdea, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

const launch = anIdea({ id: 'idea-1', title: 'Spring launch', tags: ['marketing'] });
const hiring = anIdea({ id: 'idea-2', title: 'Hiring plan', tags: ['ops'] });

describe('Idea tracking', () => {
  it('searches ideas through the API', async () => {
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [launch, hiring] },
      [`${ideasRoute}?search=hiring`]: { status: 200, body: [hiring] },
    });
    renderApp('/ideas');
    await screen.findByText('Spring launch');

    await userEvent.type(screen.getByLabelText('Search'), 'hiring');

    await waitFor(() => expect(screen.queryByText('Spring launch')).not.toBeInTheDocument());
    expect(screen.getByText('Hiring plan')).toBeInTheDocument();
    expect(calls.filter((c) => c.path.includes('search=')).map((c) => c.path)).toEqual(['/api/v1/workspaces/ws-1/ideas?search=hiring']);
  });

  it('filters by a tag in use and shows each idea’s tags', async () => {
    fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [launch, hiring] },
      'GET /api/v1/workspaces/ws-1/tags': { status: 200, body: ['marketing', 'ops'] },
      [`${ideasRoute}?tag=ops`]: { status: 200, body: [hiring] },
    });
    renderApp('/ideas');
    const card = (await screen.findByText('Spring launch')).closest('a')!;
    expect(within(card).getByRole('list', { name: 'Tags' })).toHaveTextContent('marketing');

    await userEvent.selectOptions(await screen.findByLabelText('Tag'), 'ops');

    await waitFor(() => expect(screen.queryByText('Spring launch')).not.toBeInTheDocument());
    expect(screen.getByText('Hiring plan')).toBeInTheDocument();
  });

  it('sorts through the API', async () => {
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [launch, hiring] },
      [`${ideasRoute}?sort=Title`]: { status: 200, body: [hiring, launch] },
    });
    renderApp('/ideas');
    await screen.findByText('Spring launch');

    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'Title');

    await waitFor(() => expect(calls.some((c) => c.path.endsWith('?sort=Title'))).toBe(true));
  });

  it('opens the archive', async () => {
    fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [launch] },
      [`${ideasRoute}?archived=true`]: { status: 200, body: [] },
    });
    renderApp('/ideas');
    await screen.findByText('Spring launch');

    await userEvent.click(screen.getByRole('button', { name: 'Archived' }));

    expect(await screen.findByText(/Nothing archived/)).toBeInTheDocument();
  });

  it('shows ideas on their dates in the calendar, month by month', async () => {
    const today = todayIso();
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [{ ...launch, targetDate: today }] } });
    renderApp('/ideas');
    await screen.findByText('Spring launch');

    await userEvent.click(screen.getByRole('button', { name: 'Calendar' }));

    const cell = within(screen.getByRole('table')).getByRole('link', { name: 'Spring launch' }).closest('td')!;
    expect(cell).toHaveTextContent(String(Number(today.slice(8))));
    expect(cell).toHaveClass('today');

    await userEvent.click(screen.getByRole('button', { name: /Next month/ }));
    expect(within(screen.getByRole('table')).queryByRole('link', { name: 'Spring launch' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Previous month/ }));
    expect(within(screen.getByRole('table')).getByRole('link', { name: 'Spring launch' })).toBeInTheDocument();
  });

  it('adds tags to a new idea', async () => {
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [] },
      'POST /api/v1/workspaces/ws-1/ideas': { status: 201, body: launch },
    });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'New idea' }));

    const form = screen.getByRole('form', { name: 'New idea' });
    await userEvent.type(within(form).getByLabelText('Title'), 'Spring launch');
    await userEvent.type(within(form).getByLabelText(/Tags/), 'Marketing, q4 ,');
    await userEvent.click(within(form).getByRole('button', { name: 'Add idea' }));

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
        title: 'Spring launch',
        description: null,
        targetDate: addDays(todayIso(), 14),
        tags: ['Marketing', 'q4'],
      }),
    );
  });
});

describe('Archiving an idea', () => {
  const ideaRoutes = (archivedAt: string | null) => ({
    ...signedIn,
    'GET /api/v1/ideas/idea-1': { status: 200, body: { ...launch, archivedAt } },
    'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
    'GET /api/v1/ideas/idea-1/comments': { status: 200, body: [] },
    'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
    'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
  });

  it('edits the idea’s tags', async () => {
    const calls = fakeApi({ ...ideaRoutes(null), 'PUT /api/v1/ideas/idea-1': { status: 200, body: launch } });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
    const tags = screen.getByLabelText('Tags');
    expect(tags).toHaveValue('marketing');
    await userEvent.type(tags, ', launch');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect((calls.find((c) => c.method === 'PUT')?.body as { tags: string[] }).tags).toEqual(['marketing', 'launch']));
  });

  it('archives an active idea', async () => {
    const calls = fakeApi({ ...ideaRoutes(null), 'POST /api/v1/ideas/idea-1/archive': { status: 200, body: launch } });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'Archive idea' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/archive'))).toBe(true));
  });

  it('marks an archived idea and restores it', async () => {
    const calls = fakeApi({ ...ideaRoutes('2026-10-05T09:00:00Z'), 'POST /api/v1/ideas/idea-1/restore': { status: 200, body: launch } });
    renderApp('/ideas/idea-1');

    expect(await screen.findByText(/This idea is archived/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive idea' })).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Postpone idea' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/restore'))).toBe(true));
  });
});
