import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ReceivedInvitation } from '../api/types';
import { anIdea, aWorkspace, fakeApi, ideasRoute, signedIn, signedInAccount } from '../test/fakeApi';
import { renderApp } from '../test/render';

describe('IdeasPage', () => {
  it('lists ideas with their status, overdue flag, progress, and who they belong to', async () => {
    fakeApi({
      ...signedIn,
      [ideasRoute]: {
        status: 200,
        body: [
          anIdea({ id: 'a', title: 'Spring launch', targetDate: '2020-03-01', isOverdue: true, componentCount: 4, completedComponentCount: 1 }),
          anIdea({ id: 'b', title: 'Podcast', status: 'Postponed', postponeCount: 2, role: 'Member', ownerEmail: 'leo@example.com' }),
          anIdea({ id: 'c', title: 'Webinar', role: 'Viewer', canEdit: false, canManage: false, ownerEmail: 'mia@example.com' }),
        ],
      },
    });

    renderApp('/ideas');

    const items = await within(screen.getByRole('main')).findAllByRole('listitem');
    expect(within(items[0]!).getByText('Spring launch')).toBeInTheDocument();
    expect(within(items[0]!).getByText('Overdue')).toBeInTheDocument();
    expect(within(items[0]!).getByText('1/4 ready')).toBeInTheDocument();
    expect(within(items[0]!).getByText('Only you')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Postponed')).toBeInTheDocument();
    expect(within(items[1]!).getByText('You’re on leo@example.com’s team')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Postponed 2×')).toBeInTheDocument();
    expect(within(items[2]!).getByText('By mia@example.com')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 overdue');
  });

  it('explains a failed load in plain words and loads again on Try again', async () => {
    let failing = true;
    fakeApi({
      ...signedIn,
      [ideasRoute]: () => (failing ? { status: 500, body: { title: 'Server error' } } : { status: 200, body: [anIdea()] }),
    });

    renderApp('/ideas');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We couldn’t load this. Check your connection and try again.');
    expect(alert).not.toHaveTextContent('Server error');

    failing = false;
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Black Friday teaser')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the API’s own reason when it refuses, with nothing to try again', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 403, body: { title: 'You are no longer in this workspace.' } } });

    renderApp('/ideas');

    expect(await screen.findByRole('alert')).toHaveTextContent('You are no longer in this workspace.');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('offers only a blank idea or a template when the workspace has no ideas yet', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });

    renderApp('/ideas');

    expect(await screen.findByText(/No ideas yet/)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Filter by status' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Sort by')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'View' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /idea/ }).filter((b) => b.classList.contains('primary'))).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Start from Product launch' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add a blank idea' }));
    expect(screen.getByRole('form', { name: 'New idea' })).toBeInTheDocument();
    expect(screen.queryByText(/No ideas yet/)).not.toBeInTheDocument();
  });

  it('opens the New idea form from a template shortcut in an empty workspace', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });

    renderApp('/ideas');

    await userEvent.click(await screen.findByRole('link', { name: 'Start from Marketing campaign' }));

    const form = await screen.findByRole('form', { name: 'New idea' });
    expect(within(form).getByLabelText('Start from')).toHaveValue('marketing-campaign');
    expect(screen.queryByText(/No ideas yet/)).not.toBeInTheDocument();
  });

  it('keeps the filters when every idea is archived, so the archive can still be opened', async () => {
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [] },
      [`${ideasRoute}?archived=true`]: { status: 200, body: [anIdea({ title: 'Old plan' })] },
    });

    renderApp('/ideas');

    expect(await screen.findByText(/No active ideas/)).toBeInTheDocument();

    await waitFor(() => expect(calls.some((c) => c.path === `${ideasRoute.slice(4)}?archived=true`)).toBe(true));
    await userEvent.click(await screen.findByRole('button', { name: 'Archived' }));
    expect(await screen.findByText('Old plan')).toBeInTheDocument();
  });

  it('remembers the view and order after a reload', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [anIdea()] } });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'Votes');

    cleanup();
    const calls = fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [anIdea()] } });
    renderApp('/ideas');

    expect(await screen.findByLabelText('Sort by')).toHaveValue('Votes');
    expect(screen.getByRole('button', { name: 'Board' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(calls.some((c) => c.method === 'GET' && c.path.includes('sort=Votes'))).toBe(true));
  });

  it('filters by status through the API', async () => {
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [anIdea()] },
      [`${ideasRoute}?status=Done`]: { status: 200, body: [] },
    });
    renderApp('/ideas');
    await screen.findByText('Black Friday teaser');

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findByText('No ideas match these filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/api/v1/workspaces/ws-1/ideas?status=Done')).toBe(true);
  });

  it('fades the edges of the status tabs that have more tabs beyond them', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [anIdea()] } });
    renderApp('/ideas');
    await screen.findByText('Black Friday teaser');
    const row = screen.getByRole('navigation', { name: 'Filter by status' });
    expect(row).not.toHaveAttribute('data-fade');

    // jsdom lays nothing out, so the row is given a phone's width and more tabs than fit.
    Object.defineProperty(row, 'clientWidth', { configurable: true, value: 350 });
    Object.defineProperty(row, 'scrollWidth', { configurable: true, value: 600 });
    fireEvent.scroll(row);
    expect(row).toHaveAttribute('data-fade', 'end');

    row.scrollLeft = 100;
    fireEvent.scroll(row);
    expect(row).toHaveAttribute('data-fade', 'both');

    row.scrollLeft = 250;
    fireEvent.scroll(row);
    expect(row).toHaveAttribute('data-fade', 'start');
  });

  it('confirms a new idea in a toast naming it, whose Open goes to the idea', async () => {
    fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [] },
      'POST /api/v1/workspaces/ws-1/ideas': { status: 201, body: anIdea({ id: 'idea-9', title: 'Webinar series' }) },
    });
    const router = renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'New idea' }));

    const form = screen.getByRole('form', { name: 'New idea' });
    await userEvent.type(within(form).getByLabelText('Title'), 'Webinar series');
    await userEvent.click(within(form).getByRole('button', { name: 'Add idea' }));

    expect(await screen.findByText('Added “Webinar series”')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'New idea' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/ideas/idea-9'));
  });

  it('creates an idea in the current workspace and shows the API validation message for a bad date', async () => {
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [] },
      'POST /api/v1/workspaces/ws-1/ideas': { status: 400, body: { errors: { targetDate: ['The target date cannot be in the past.'] } } },
    });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'New idea' }));

    const form = screen.getByRole('form', { name: 'New idea' });
    await userEvent.type(within(form).getByLabelText('Title'), 'Webinar series');
    await userEvent.click(within(form).getByRole('button', { name: 'Add idea' }));

    expect(await within(form).findByText('The target date cannot be in the past.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ title: 'Webinar series', description: null });
  });

  it('switches workspace from the header and remembers the choice', async () => {
    fakeApi({
      ...signedIn,
      'GET /api/v1/workspaces': {
        status: 200,
        body: [aWorkspace(), aWorkspace({ id: 'ws-2', name: 'Globex', role: 'Member', memberCount: 5 })],
      },
      [ideasRoute]: { status: 200, body: [anIdea({ title: 'Acme idea' })] },
      'GET /api/v1/workspaces/ws-2/ideas': { status: 200, body: [anIdea({ id: 'g', workspaceId: 'ws-2', title: 'Globex idea' })] },
    });
    const router = renderApp('/ideas');
    await screen.findByText('Acme idea');

    await userEvent.click(screen.getByRole('button', { name: 'Workspace: Acme Marketing' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: /Globex/ }));

    expect(await screen.findByText('Globex idea')).toBeInTheDocument();
    expect(screen.queryByText('Acme idea')).not.toBeInTheDocument();
    expect(localStorage.getItem('ideaverse.workspace')).toBe('ws-2');
    expect(router.state.location.pathname).toBe('/ideas');
  });

  it('leaves an idea for the new workspace’s list when switching workspace', async () => {
    fakeApi({
      ...signedIn,
      'GET /api/v1/workspaces': {
        status: 200,
        body: [aWorkspace(), aWorkspace({ id: 'ws-2', name: 'Globex', role: 'Member', memberCount: 5 })],
      },
      'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea({ title: 'Acme idea' }) },
      'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
      'GET /api/v1/ideas/idea-1/comments': { status: 200, body: [] },
      'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-2/ideas': { status: 200, body: [anIdea({ id: 'g', workspaceId: 'ws-2', title: 'Globex idea' })] },
    });
    const router = renderApp('/ideas/idea-1');
    await screen.findByRole('heading', { name: 'Acme idea' });

    await userEvent.click(screen.getByRole('button', { name: 'Workspace: Acme Marketing' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: /Globex/ }));

    expect(await screen.findByText('Globex idea')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ideas');
  });

  it('opens the new idea form only once when asked from the dashboard', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [anIdea()] } });
    const router = renderApp('/');

    await userEvent.click(await screen.findByRole('link', { name: 'New idea' }));

    expect(await screen.findByRole('form', { name: 'New idea' })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.state).toBeNull());
  });

  describe('density', () => {
    const ideas = [
      anIdea({ id: 'a', title: 'Spring launch', targetDate: '2020-03-01', isOverdue: true, componentCount: 4, completedComponentCount: 1, tags: ['marketing'] }),
      anIdea({ id: 'b', title: 'Podcast', status: 'Done' }),
    ];

    it('shows each idea as one row in the compact list, and remembers the choice', async () => {
      fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: ideas } });
      renderApp('/ideas');
      await screen.findByText('Spring launch');
      const density = screen.getByRole('group', { name: 'Density' });
      expect(within(density).getByRole('button', { name: 'Comfortable' })).toHaveAttribute('aria-pressed', 'true');

      await userEvent.click(within(density).getByRole('button', { name: 'Compact' }));

      const items = within(screen.getByRole('main')).getAllByRole('listitem').filter((li) => li.classList.contains('idea-item'));
      expect(within(items[0]!).getByRole('link', { name: 'Spring launch' })).toBeInTheDocument();
      expect(within(items[0]!).getByText('Overdue')).toBeInTheDocument();
      expect(within(items[0]!).getByText('Sun, Mar 1, 2020')).toHaveClass('overdue-text');
      expect(within(items[0]!).getByText('Only you')).toBeInTheDocument();
      expect(within(items[0]!).getByText('1/4 ready')).toBeInTheDocument();
      expect(within(items[0]!).getByRole('link', { name: 'Ideas tagged marketing' })).toBeInTheDocument();
      expect(within(items[0]!).getByRole('button', { name: /Vote for Spring launch/ })).toBeInTheDocument();
      // Finished ideas step back.
      expect(within(items[1]!).getByRole('link', { name: 'Podcast' }).closest('.idea-card')).toHaveClass('is-done');
      expect(within(items[0]!).getByRole('link', { name: 'Spring launch' }).closest('.idea-card')).not.toHaveClass('is-done');

      cleanup();
      fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: ideas } });
      renderApp('/ideas');
      await screen.findByText('Spring launch');
      expect(within(screen.getByRole('group', { name: 'Density' })).getByRole('button', { name: 'Compact' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('dims finished ideas in the comfortable list too, and offers density only on the List view', async () => {
      fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: ideas } });
      renderApp('/ideas');

      expect((await screen.findByRole('link', { name: 'Podcast' })).closest('.idea-card')).toHaveClass('is-done');
      await userEvent.click(screen.getByRole('button', { name: 'Board' }));
      expect(screen.queryByRole('group', { name: 'Density' })).not.toBeInTheDocument();
    });
  });

  describe('filters in the address', () => {
    it('opens the list as the address describes it, over the remembered choices', async () => {
      localStorage.setItem('ideaverse.ideas.ws-1', JSON.stringify({ tab: 'Planned', sort: 'Title', view: 'board' }));
      const calls = fakeApi({
        ...signedIn,
        [`${ideasRoute}?status=Done&search=spring&tag=marketing&sort=Votes`]: { status: 200, body: [anIdea({ title: 'Spring launch', status: 'Done' })] },
        'GET /api/v1/workspaces/ws-1/tags': { status: 200, body: ['marketing', 'ops'] },
      });
      const router = renderApp('/ideas?status=Done&tag=marketing&q=spring&sort=Votes&view=list');

      expect(await screen.findByRole('link', { name: 'Spring launch' })).toBeInTheDocument();
      // The link's List stays in the address, rather than giving way to the remembered board once the address is tidied.
      await waitFor(() => expect(Object.fromEntries(new URLSearchParams(router.state.location.search))).toEqual({ status: 'Done', tag: 'marketing', q: 'spring', sort: 'Votes', view: 'list' }));
      expect(screen.getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('Search')).toHaveValue('spring');
      expect(screen.getByLabelText('Sort by')).toHaveValue('Votes');
      expect(await screen.findByLabelText('Tag')).toHaveValue('marketing');
      expect(calls.filter((c) => c.path.startsWith('/api/v1/workspaces/ws-1/ideas')).map((c) => c.path)).toEqual([
        '/api/v1/workspaces/ws-1/ideas?status=Done&search=spring&tag=marketing&sort=Votes',
      ]);
      // A shared link doesn't replace what the user chose for themselves.
      expect(JSON.parse(localStorage.getItem('ideaverse.ideas.ws-1')!)).toEqual({ tab: 'Planned', sort: 'Title', view: 'board' });
    });

    it('takes every filter from an address that has any, so a shared link shows everyone the same list', async () => {
      localStorage.setItem('ideaverse.ideas.ws-1', JSON.stringify({ tab: 'Planned', tag: 'marketing', view: 'board' }));
      const calls = fakeApi({ ...signedIn, [`${ideasRoute}?search=e&sort=Title`]: { status: 200, body: [anIdea()] } });
      const router = renderApp('/ideas?sort=Title&q=e');

      expect(await screen.findByText('Black Friday teaser')).toBeInTheDocument();
      // The view only changes how the list is shown, so the remembered one still applies.
      expect(screen.getByRole('button', { name: 'Board' })).toHaveAttribute('aria-pressed', 'true');
      // The order of the parameters depends on timing, so compare them, not the string.
      await waitFor(() => expect(Object.fromEntries(new URLSearchParams(router.state.location.search))).toEqual({ sort: 'Title', q: 'e', view: 'board' }));
      expect(calls.filter((c) => c.path.startsWith('/api/v1/workspaces/ws-1/ideas')).map((c) => c.path)).toEqual(['/api/v1/workspaces/ws-1/ideas?search=e&sort=Title']);
      expect(JSON.parse(localStorage.getItem('ideaverse.ideas.ws-1')!)).toEqual({ tab: 'Planned', tag: 'marketing', view: 'board' });
    });

    it('opens a tag chip’s link on that tag alone, without the remembered status', async () => {
      localStorage.setItem('ideaverse.ideas.ws-1', JSON.stringify({ tab: 'Planned' }));
      const calls = fakeApi({
        ...signedIn,
        [`${ideasRoute}?tag=ops`]: { status: 200, body: [anIdea()] },
        'GET /api/v1/workspaces/ws-1/tags': { status: 200, body: ['marketing', 'ops'] },
      });
      renderApp('/ideas?tag=ops');

      expect(await screen.findByText('Black Friday teaser')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
      expect(calls.some((c) => c.path.includes('status='))).toBe(false);
    });

    it('remembers the list as shown once a filter on a shared link is changed', async () => {
      localStorage.setItem('ideaverse.ideas.ws-1', JSON.stringify({ tab: 'Planned' }));
      fakeApi({
        ...signedIn,
        [ideasRoute]: { status: 200, body: [anIdea()] },
        [`${ideasRoute}?tag=ops`]: { status: 200, body: [anIdea()] },
        [`${ideasRoute}?tag=ops&sort=Votes`]: { status: 200, body: [anIdea()] },
        [`${ideasRoute}?sort=Votes`]: { status: 200, body: [anIdea()] },
        'GET /api/v1/workspaces/ws-1/tags': { status: 200, body: ['marketing', 'ops'] },
      });
      const router = renderApp('/ideas?tag=ops');
      await screen.findByText('Black Friday teaser');

      await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'Votes');
      expect(JSON.parse(localStorage.getItem('ideaverse.ideas.ws-1')!)).toMatchObject({ tab: 'All', tag: 'ops', sort: 'Votes' });

      // With no tag left, the address still has the order, and the status stays as shown rather than the earlier Planned.
      await userEvent.selectOptions(await screen.findByLabelText('Tag'), '');
      expect(router.state.location.search).toBe('?sort=Votes');
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
      expect(JSON.parse(localStorage.getItem('ideaverse.ideas.ws-1')!)).toMatchObject({ tab: 'All', tag: '', sort: 'Votes' });
    });

    it('puts the remembered choices in the address, so the list as it opens can be shared', async () => {
      localStorage.setItem('ideaverse.ideas.ws-1', JSON.stringify({ tab: 'Planned', sort: 'Title' }));
      fakeApi({ ...signedIn, [`${ideasRoute}?status=Planned&sort=Title`]: { status: 200, body: [anIdea()] } });
      const router = renderApp('/ideas');

      expect(await screen.findByText('Black Friday teaser')).toBeInTheDocument();
      await waitFor(() => expect(router.state.location.search).toBe('?status=Planned&sort=Title'));
      expect(router.state.historyAction).toBe('REPLACE');
    });

    it('keeps each change in the address without adding to the history, alongside an open idea', async () => {
      fakeApi({
        ...signedIn,
        [ideasRoute]: { status: 200, body: [anIdea()] },
        [`${ideasRoute}?status=Done`]: { status: 200, body: [anIdea({ status: 'Done' })] },
        [`${ideasRoute}?status=Done&search=black`]: { status: 200, body: [anIdea({ status: 'Done' })] },
        'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea({ status: 'Done' }) },
        'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
        'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
      });
      const router = renderApp('/ideas');
      await screen.findByText('Black Friday teaser');

      await userEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(router.state.location.search).toBe('?status=Done');
      expect(router.state.historyAction).toBe('REPLACE');
      await userEvent.type(screen.getByLabelText('Search'), 'black');
      await waitFor(() => expect(router.state.location.search).toBe('?status=Done&q=black'));

      await userEvent.click(screen.getByRole('link', { name: 'Black Friday teaser' }));
      expect(await screen.findByRole('dialog', { name: 'Black Friday teaser' })).toBeInTheDocument();
      // The panel's link can be built before the search reaches the address, so only the parameters are compared, not their order.
      expect(Object.fromEntries(new URLSearchParams(router.state.location.search))).toEqual({ status: 'Done', q: 'black', idea: 'idea-1' });

      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(router.state.location.search).toBe('?status=Done&q=black');

      // Back to the defaults, the address is plain again.
      await userEvent.click(screen.getByRole('button', { name: 'All' }));
      await userEvent.clear(screen.getByLabelText('Search'));
      await waitFor(() => expect(router.state.location.search).toBe(''));
    });

    it('clears every filter at once from an empty result', async () => {
      fakeApi({
        ...signedIn,
        [ideasRoute]: { status: 200, body: [anIdea()] },
        [`${ideasRoute}?status=Done&tag=ops`]: { status: 200, body: [] },
      });
      const router = renderApp('/ideas?status=Done&tag=ops');

      await userEvent.click(await screen.findByRole('button', { name: 'Clear filters' }));

      expect(await screen.findByText('Black Friday teaser')).toBeInTheDocument();
      expect(router.state.location.search).toBe('');
    });
  });

  describe('without a workspace', () => {
    const invitation: ReceivedInvitation = {
      id: 'inv-1',
      workspaceId: 'ws-2',
      workspaceName: 'Globex',
      role: 'Member',
      invitedByEmail: 'leo@example.com', invitedByName: null,
      expiresAt: '2099-01-08T09:00:00Z',
    };

    it('welcomes the user and creates their first workspace', async () => {
      let workspaces: unknown[] = [];
      const calls = fakeApi({
        ...signedIn,
        'GET /api/v1/workspaces': () => ({ status: 200, body: workspaces }),
        'POST /api/v1/workspaces': (body) => {
          workspaces = [aWorkspace({ name: (body as { name: string }).name })];
          return { status: 201, body: workspaces[0] };
        },
        [ideasRoute]: { status: 200, body: [] },
      });
      const router = renderApp('/ideas');

      expect(await screen.findByRole('heading', { name: 'Welcome to IdeaVerse' })).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Setting up your workspace' })).toHaveTextContent('1Name your workspace2Invite your team');
      const form = screen.getByRole('form', { name: 'Create workspace' });
      await userEvent.type(within(form).getByLabelText('Workspace name'), 'Acme Marketing');
      await userEvent.click(within(form).getByRole('button', { name: 'Create workspace' }));

      expect(await screen.findByRole('heading', { name: 'Invite your team to Acme Marketing' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

      expect(await screen.findByRole('region', { name: 'Get started' })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/');
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Acme Marketing' });
    });

    it('asks for the user’s name while creating their first workspace, so teammates see it', async () => {
      let workspaces: unknown[] = [];
      const calls = fakeApi({
        ...signedIn,
        'GET /api/v1/workspaces': () => ({ status: 200, body: workspaces }),
        'PUT /api/v1/account/profile': (body) => ({ status: 200, body: { ...signedInAccount, ...(body as object) } }),
        'POST /api/v1/workspaces': (body) => {
          workspaces = [aWorkspace({ name: (body as { name: string }).name })];
          return { status: 201, body: workspaces[0] };
        },
        [ideasRoute]: { status: 200, body: [] },
      });
      renderApp('/ideas');

      const form = await screen.findByRole('form', { name: 'Create workspace' });
      expect(within(form).getByLabelText('Your name')).toHaveValue('');
      await userEvent.type(within(form).getByLabelText('Workspace name'), 'Acme Marketing');
      await userEvent.type(within(form).getByLabelText('Your name'), '  Kat Smith ');
      await userEvent.click(within(form).getByRole('button', { name: 'Create workspace' }));

      expect(await screen.findByRole('heading', { name: 'Invite your team to Acme Marketing' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Account: Kat Smith' })).toBeInTheDocument();
      expect(calls.filter((c) => c.method === 'PUT' || c.method === 'POST').map((c) => [c.method, c.path, c.body])).toEqual([
        ['PUT', '/api/v1/account/profile', { displayName: 'Kat Smith' }],
        ['POST', '/api/v1/workspaces', { name: 'Acme Marketing' }],
      ]);
    });

    it('keeps the name the user already has, and leaves it alone unless changed', async () => {
      const calls = fakeApi({
        ...signedIn,
        'GET /api/v1/account': { status: 200, body: { ...signedInAccount, displayName: 'Kat Smith' } },
        'GET /api/v1/workspaces': { status: 200, body: [] },
        'POST /api/v1/workspaces': { status: 201, body: aWorkspace() },
        [ideasRoute]: { status: 200, body: [] },
      });
      renderApp('/ideas');

      const form = await screen.findByRole('form', { name: 'Create workspace' });
      expect(within(form).getByLabelText('Your name')).toHaveValue('Kat Smith');
      await userEvent.type(within(form).getByLabelText('Workspace name'), 'Acme Marketing');
      await userEvent.click(within(form).getByRole('button', { name: 'Create workspace' }));

      await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/api/v1/workspaces')).toBe(true));
      expect(calls.some((c) => c.method === 'PUT')).toBe(false);
    });

    it('does not ask an existing user for their name when they start another workspace', async () => {
      fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
      renderApp('/workspaces/new');

      const form = await screen.findByRole('form', { name: 'Create workspace' });
      expect(within(form).queryByLabelText('Your name')).not.toBeInTheDocument();
    });

    it('invites the team in the second step, keeping only the addresses that were refused', async () => {
      const calls = fakeApi({
        ...signedIn,
        [ideasRoute]: { status: 200, body: [] },
        'POST /api/v1/workspaces/ws-1/invitations': (body) =>
          (body as { email: string }).email === 'kat@example.com'
            ? { status: 400, body: { errors: { email: ['This person is already in the workspace.'] } } }
            : { status: 201, body: {} },
      });
      const router = renderApp('/workspaces/ws-1/invite');

      const form = await screen.findByRole('form', { name: 'Invite your team' });
      await userEvent.type(within(form).getByLabelText('Email 1'), 'mia@example.com');
      await userEvent.type(within(form).getByLabelText('Email 2'), 'kat@example.com');
      await userEvent.selectOptions(within(form).getByLabelText('Invite them as'), 'Admin');
      await userEvent.click(within(form).getByRole('button', { name: 'Send invitations' }));

      expect(await screen.findByText('Invitation sent')).toBeInTheDocument();
      expect(within(form).getByLabelText('Email 1')).toHaveValue('kat@example.com');
      expect(within(form).getByLabelText('Email 1')).toHaveAccessibleDescription('This person is already in the workspace.');
      expect(within(form).queryByLabelText('Email 2')).not.toBeInTheDocument();
      expect(calls.filter((c) => c.method === 'POST').map((c) => c.body)).toEqual([
        { email: 'mia@example.com', role: 'Admin' },
        { email: 'kat@example.com', role: 'Admin' },
      ]);
      expect(router.state.location.pathname).toBe('/workspaces/ws-1/invite');

      await userEvent.clear(within(form).getByLabelText('Email 1'));
      await userEvent.type(within(form).getByLabelText('Email 1'), 'leo@example.com');
      await userEvent.click(within(form).getByRole('button', { name: 'Send invitations' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    });

    it('does not offer to invite to a workspace the user cannot manage', async () => {
      fakeApi({ ...signedIn, 'GET /api/v1/workspaces': { status: 200, body: [aWorkspace({ role: 'Member' })] }, [ideasRoute]: { status: 200, body: [] } });
      const router = renderApp('/workspaces/ws-1/invite');

      await waitFor(() => expect(router.state.location.pathname).toBe('/ideas'));
    });

    it('joins a workspace they were invited to', async () => {
      let workspaces: unknown[] = [];
      const calls = fakeApi({
        ...signedIn,
        'GET /api/v1/workspaces': () => ({ status: 200, body: workspaces }),
        'GET /api/v1/invitations': () => ({ status: 200, body: workspaces.length ? [] : [invitation] }),
        'POST /api/v1/invitations/inv-1/accept': () => {
          workspaces = [aWorkspace({ id: 'ws-2', name: 'Globex', role: 'Member' })];
          return { status: 200, body: workspaces[0] };
        },
        'GET /api/v1/workspaces/ws-2/ideas': { status: 200, body: [anIdea({ workspaceId: 'ws-2', title: 'Globex idea', role: 'Viewer' })] },
      });
      renderApp('/ideas');

      expect(await screen.findByText(/leo@example.com invited you as a member/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Join Globex' }));

      expect(await screen.findByText('Globex idea')).toBeInTheDocument();
      await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/api/v1/invitations/inv-1/accept')).toBe(true));
    });
  });
});
