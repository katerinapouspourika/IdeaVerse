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
    const card = (await screen.findByText('Spring launch')).closest('li')!;
    expect(within(card).getByRole('list', { name: 'Tags' })).toHaveTextContent('marketing');

    await userEvent.selectOptions(await screen.findByLabelText('Tag'), 'ops');

    await waitFor(() => expect(screen.queryByText('Spring launch')).not.toBeInTheDocument());
    expect(screen.getByText('Hiring plan')).toBeInTheDocument();
  });

  it('filters by a tag clicked on an idea in the list', async () => {
    fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [launch, hiring] },
      'GET /api/v1/workspaces/ws-1/tags': { status: 200, body: ['marketing', 'ops'] },
      [`${ideasRoute}?tag=ops`]: { status: 200, body: [hiring] },
    });
    const router = renderApp('/ideas');
    const card = (await screen.findByText('Hiring plan')).closest('li')!;

    await userEvent.click(within(card).getByRole('link', { name: 'Ideas tagged ops' }));

    await waitFor(() => expect(screen.queryByText('Spring launch')).not.toBeInTheDocument());
    expect(screen.getByText('Hiring plan')).toBeInTheDocument();
    expect(screen.getByLabelText('Tag')).toHaveValue('ops');
    // The tag stays in the address, so the filtered list can be shared.
    expect(router.state.location.search).toBe('?tag=ops');
  });

  it('opens the ideas with a tag clicked on an idea’s page', async () => {
    fakeApi({
      ...signedIn,
      'GET /api/v1/ideas/idea-1': { status: 200, body: launch },
      'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
      'GET /api/v1/ideas/idea-1/comments': { status: 200, body: [] },
      'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-1/tags': { status: 200, body: ['marketing', 'ops'] },
      [`${ideasRoute}?tag=marketing`]: { status: 200, body: [launch] },
    });
    const router = renderApp('/ideas/idea-1');
    const tags = await screen.findByRole('list', { name: 'Tags' });

    await userEvent.click(within(tags).getByRole('link', { name: 'Ideas tagged marketing' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/ideas'));
    expect(await screen.findByLabelText('Tag')).toHaveValue('marketing');
    expect(await screen.findByRole('link', { name: 'Spring launch' })).toBeInTheDocument();
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

  it('opens an idea in the side panel from its calendar chips, which name it in full on hover', async () => {
    const today = todayIso();
    const planned = { ...launch, startDate: `${today.slice(0, 7)}-01`, targetDate: `${today.slice(0, 7)}-28` };
    fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [planned] },
      'GET /api/v1/ideas/idea-1': { status: 200, body: planned },
      'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
    });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Calendar' }));

    const table = screen.getByRole('table');
    expect(within(table).getByRole('link', { name: 'Starts: Spring launch' })).toHaveAttribute('title', 'Starts: Spring launch');
    const chip = within(table).getByRole('link', { name: 'Spring launch' });
    expect(chip).toHaveAttribute('title', 'Spring launch');
    expect(chip).toHaveAttribute('href', '/ideas/idea-1');
    await userEvent.click(chip);

    expect(await screen.findByRole('dialog', { name: 'Spring launch' })).toBeInTheDocument();
  });

  it('shows a planned span in the calendar from its start day to its target date', async () => {
    const month = todayIso().slice(0, 7);
    const span = (id: string, title: string) => anIdea({ id, title, startDate: `${month}-01`, targetDate: `${month}-28` });
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: ['a', 'b', 'c', 'd'].map((id) => span(id, `Plan ${id}`)) } });
    renderApp('/ideas');
    await screen.findByText('Plan a');

    await userEvent.click(screen.getByRole('button', { name: 'Calendar' }));

    const table = screen.getByRole('table');
    const dayOf = (name: string) => within(table).getByRole('link', { name }).closest('td')!.querySelector('.day')!.textContent;
    expect(dayOf('Starts: Plan a')).toBe('1');
    expect(dayOf('Plan a')).toBe('28');
    // The 26 days in between each show a line per idea, up to three, and a count of the rest.
    const between = [...table.querySelectorAll('td')].filter((td) => td.querySelector('.calendar-spans'));
    expect(between).toHaveLength(26);
    expect(between[0]!.querySelectorAll('.calendar-span')).toHaveLength(3);
    expect(between[0]).toHaveTextContent('+1');
    expect(screen.getByText(/on the start day, filled on the target date/)).toBeInTheDocument();
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
    const tags = within(form).getByLabelText(/Tags/);
    await userEvent.type(tags, 'Marketing{Enter}');
    await userEvent.type(tags, 'q4,');
    await userEvent.type(tags, 'marketing{Enter}');

    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    expect(within(form).getByRole('list', { name: 'Chosen tags' }).textContent).toBe('marketing×q4×');
    expect(tags).toHaveValue('');

    await userEvent.type(tags, 'draft');
    await userEvent.click(within(form).getByRole('button', { name: 'Add idea' }));

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
        title: 'Spring launch',
        description: null,
        targetDate: addDays(todayIso(), 14),
        tags: ['marketing', 'q4', 'draft'],
        startDate: null,
        startTime: null,
      }),
    );
  });

  it('removes tags with their button or Backspace', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'New idea' }));
    const form = screen.getByRole('form', { name: 'New idea' });
    const tags = within(form).getByLabelText(/Tags/);
    await userEvent.type(tags, 'one{Enter}two{Enter}three{Enter}');

    await userEvent.click(within(form).getByRole('button', { name: 'Remove tag two' }));
    await userEvent.type(tags, '{Backspace}');

    expect(within(form).getByRole('list', { name: 'Chosen tags' }).textContent).toBe('one×');
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
    expect(screen.getByRole('list', { name: 'Chosen tags' })).toHaveTextContent('marketing');
    await userEvent.type(screen.getByLabelText('Tags'), 'launch{Enter}');
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect((calls.find((c) => c.method === 'PUT')?.body as { tags: string[] }).tags).toEqual(['marketing', 'launch']));
  });

  it('archives an active idea', async () => {
    const calls = fakeApi({ ...ideaRoutes(null), 'POST /api/v1/ideas/idea-1/archive': { status: 200, body: launch } });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'More actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Archive idea' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/archive'))).toBe(true));
    expect(await screen.findByText('Idea archived')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('marks an archived idea and restores it', async () => {
    const calls = fakeApi({ ...ideaRoutes('2026-10-05T09:00:00Z'), 'POST /api/v1/ideas/idea-1/restore': { status: 200, body: launch } });
    renderApp('/ideas/idea-1');

    expect(await screen.findByText(/This idea is archived/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.queryByRole('menuitem', { name: 'Archive idea' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Postpone' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/restore'))).toBe(true));
  });
});
