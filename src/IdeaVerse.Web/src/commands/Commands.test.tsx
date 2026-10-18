import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { anIdea, aWorkspace, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

const launch = anIdea({ id: 'idea-1', title: 'Spring launch' });

const routes = {
  ...signedIn,
  [ideasRoute]: { status: 200, body: [launch] },
  [`${ideasRoute}?search=spring`]: { status: 200, body: [launch] },
  'GET /api/v1/ideas/idea-1': { status: 200, body: launch },
  'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
  'GET /api/v1/ideas/idea-1/comments': { status: 200, body: [] },
  'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
  'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
};

/** Waits for the signed-in page, so key presses reach the app rather than a page still loading. */
async function ready() {
  await screen.findByRole('heading', { name: 'Ideas' });
}

describe('Command palette', () => {
  it('opens with Ctrl+K, finds an idea, and opens it with Enter', async () => {
    const calls = fakeApi(routes);
    const router = renderApp('/ideas');
    await ready();

    await userEvent.keyboard('{Control>}k{/Control}');
    const palette = screen.getByRole('dialog', { name: 'Search and commands' });
    const input = within(palette).getByRole('combobox', { name: 'Search ideas or type a command' });
    expect(input).toHaveFocus();
    await userEvent.type(input, 'spring');

    const option = await within(palette).findByRole('option', { name: /Spring launch/ });
    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', option.id);
    expect(calls.some((c) => c.path === '/api/v1/workspaces/ws-1/ideas?search=spring')).toBe(true);
    await userEvent.keyboard('{Enter}');

    await waitFor(() => expect(router.state.location.pathname).toBe('/ideas/idea-1'));
    expect(screen.queryByRole('dialog', { name: 'Search and commands' })).not.toBeInTheDocument();
  });

  it('filters actions as you type and runs the chosen one', async () => {
    fakeApi({ ...routes, 'GET /api/v1/workspaces/ws-1/invitations': { status: 200, body: [] } });
    const router = renderApp('/ideas');
    await ready();

    await userEvent.click(screen.getByRole('button', { name: 'Search and commands' }));
    await userEvent.type(screen.getByRole('combobox', { name: 'Search ideas or type a command' }), 'go to');
    const options = within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Go to Ideas', 'Go to People', 'Go to Home', 'Go to Notifications', 'Go to Settings']);
    await userEvent.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => expect(router.state.location.pathname).toBe('/people'));
  });

  it('opens the new idea form, even on the ideas page', async () => {
    fakeApi(routes);
    renderApp('/ideas');
    await ready();

    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.type(screen.getByRole('combobox', { name: 'Search ideas or type a command' }), 'new');
    await userEvent.keyboard('{Enter}');

    expect(await screen.findByRole('form', { name: 'New idea' })).toBeInTheDocument();
  });

  it('switches to another workspace', async () => {
    fakeApi({
      ...routes,
      'GET /api/v1/workspaces': { status: 200, body: [aWorkspace(), aWorkspace({ id: 'ws-2', name: 'Studio' })] },
      'GET /api/v1/workspaces/ws-2/ideas': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-2/assignments': { status: 200, body: [] },
    });
    renderApp('/ideas');
    await ready();

    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.type(screen.getByRole('combobox', { name: 'Search ideas or type a command' }), 'studio');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Workspace' })).toHaveValue('ws-2'));
  });

  it('closes with Escape and gives focus back', async () => {
    fakeApi(routes);
    renderApp('/ideas');
    await ready();
    const button = screen.getByRole('button', { name: 'Search and commands' });

    await userEvent.click(button);
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Search and commands' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
});

describe('Keyboard shortcuts', () => {
  it('goes places with G then a letter, and starts a new idea with N', async () => {
    fakeApi(routes);
    const router = renderApp('/ideas/idea-1');
    await screen.findByRole('heading', { level: 1, name: 'Spring launch' });

    await userEvent.keyboard('gi');
    await waitFor(() => expect(router.state.location.pathname).toBe('/ideas'));
    await ready();

    await userEvent.keyboard('n');
    expect(await screen.findByRole('form', { name: 'New idea' })).toBeInTheDocument();
  });

  it('ignores single keys while typing in a field', async () => {
    fakeApi(routes);
    const router = renderApp('/ideas');
    await ready();

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'gp/?');

    expect(router.state.location.pathname).toBe('/ideas');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lists the shortcuts with ?', async () => {
    fakeApi(routes);
    renderApp('/ideas');
    await ready();

    await userEvent.keyboard('?');

    const help = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(help).getByText('New idea')).toBeInTheDocument();
    await userEvent.click(within(help).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the palette with /, and goes to Notifications with G then N', async () => {
    fakeApi(routes);
    const router = renderApp('/ideas');
    await ready();

    await userEvent.keyboard('/');
    expect(screen.getByRole('dialog', { name: 'Search and commands' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('gn');

    await waitFor(() => expect(router.state.location.pathname).toBe('/notifications'));
    expect(screen.queryByRole('form', { name: 'New idea' })).not.toBeInTheDocument();
  });

  it('forgets G once another key is pressed', async () => {
    fakeApi(routes);
    const router = renderApp('/ideas/idea-1');
    await screen.findByRole('heading', { level: 1, name: 'Spring launch' });

    await userEvent.keyboard('gxi');

    expect(router.state.location.pathname).toBe('/ideas/idea-1');
  });

  it('waits while another dialog is open, Ctrl+K included', async () => {
    fakeApi(routes);
    renderApp('/ideas?idea=idea-1');
    await screen.findByRole('dialog', { name: 'Spring launch' });

    await userEvent.keyboard('{Control>}k{/Control}?');

    expect(screen.queryByRole('dialog', { name: 'Search and commands' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
  });
});

describe('Command palette results', () => {
  it('lists ideas only for the text typed now, so Enter never opens an earlier match', async () => {
    fakeApi({ ...routes, [`${ideasRoute}?search=summer`]: { status: 200, body: [] } });
    const router = renderApp('/ideas');
    await ready();

    await userEvent.keyboard('{Control>}k{/Control}');
    const input = screen.getByRole('combobox', { name: 'Search ideas or type a command' });
    await userEvent.type(input, 'spring');
    await screen.findByRole('option', { name: /Spring launch/ });
    await userEvent.clear(input);
    await userEvent.type(input, 'summer');

    expect(screen.queryByRole('option', { name: /Spring launch/ })).not.toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(router.state.location.pathname).toBe('/ideas');
    expect(await screen.findByText('Nothing matches.')).toBeInTheDocument();
  });

  it('ranks a whole title, then its start, then a word’s start, then anywhere in it, then the description', async () => {
    const found = [
      anIdea({ id: 'a', title: 'Notes', description: 'A list of everything' }),
      anIdea({ id: 'b', title: 'Customer onboarding checklist' }),
      anIdea({ id: 'c', title: 'Team offsite in Lisbon' }),
      anIdea({ id: 'd', title: 'Listening tour' }),
      anIdea({ id: 'e', title: 'LIS' }),
      anIdea({ id: 'f', title: 'Lisbon follow-up' }),
    ];
    fakeApi({ ...routes, [`${ideasRoute}?search=lis`]: { status: 200, body: found } });
    renderApp('/ideas');
    await ready();

    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.type(screen.getByRole('combobox', { name: 'Search ideas or type a command' }), 'lis');

    const ideas = await screen.findByRole('group', { name: 'Ideas' });
    expect(within(ideas).getAllByRole('option').map((o) => o.querySelector('.grow')?.textContent)).toEqual([
      'LIS',
      'Listening tour',
      'Lisbon follow-up',
      'Team offsite in Lisbon',
      'Customer onboarding checklist',
      'Notes',
    ]);
  });

  it('offers the ideas opened lately in this workspace before anything is typed', async () => {
    localStorage.setItem('ideaverse.recentIdeas', JSON.stringify([{ id: 'idea-9', workspaceId: 'ws-2', title: 'Elsewhere' }]));
    fakeApi(routes);
    const router = renderApp('/ideas/idea-1');
    await screen.findByRole('heading', { name: 'Spring launch' });

    await userEvent.keyboard('{Control>}k{/Control}');
    const recent = screen.getByRole('group', { name: 'Recent ideas' });
    expect(within(recent).getAllByRole('option').map((o) => o.textContent)).toEqual(['Spring launch']);
    expect(within(recent).getByRole('option')).toHaveAttribute('aria-selected', 'true');
    await userEvent.type(screen.getByRole('combobox', { name: 'Search ideas or type a command' }), 'go');
    expect(screen.queryByRole('group', { name: 'Recent ideas' })).not.toBeInTheDocument();

    await userEvent.clear(screen.getByRole('combobox', { name: 'Search ideas or type a command' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Recent ideas' })).getByRole('option', { name: 'Spring launch' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/ideas/idea-1'));
  });

  it('keeps focus inside while tabbing', async () => {
    fakeApi(routes);
    renderApp('/ideas');
    await ready();

    await userEvent.keyboard('?');
    const close = within(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();
    await userEvent.tab();

    expect(close).toHaveFocus();
  });
});

describe('Idea actions in the command palette', () => {
  /** Opens the palette on the ideas page and finds Spring launch. */
  async function findSpringLaunch() {
    await ready();
    await userEvent.keyboard('{Control>}k{/Control}');
    const input = screen.getByRole('combobox', { name: 'Search ideas or type a command' });
    await userEvent.type(input, 'spring');
    await screen.findByRole('option', { name: /Spring launch/ });
    return input;
  }

  it('lists the highlighted idea’s actions with Tab and changes its status, with Undo', async () => {
    const calls = fakeApi({
      ...routes,
      'PUT /api/v1/ideas/idea-1': (body) => ({ status: 200, body: { ...launch, ...(body as object) } }),
    });
    renderApp('/ideas');
    await findSpringLaunch();

    await userEvent.keyboard('{Tab}');
    const actions = await screen.findByRole('group', { name: 'Actions for Spring launch' });
    await within(actions).findByRole('option', { name: 'Set status to Done' });
    expect(screen.getByRole('status')).toHaveTextContent('6 actions');
    expect(within(actions).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Open',
      'Open in side panel',
      'Copy link',
      'Set status to In progress',
      'Set status to Postponed',
      'Set status to Done',
    ]);

    await userEvent.type(screen.getByRole('combobox', { name: 'Search ideas or type a command' }), 'done');
    await userEvent.keyboard('{Enter}');

    expect(screen.queryByRole('dialog', { name: 'Search and commands' })).not.toBeInTheDocument();
    expect(await screen.findByText('“Spring launch” set to Done')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ status: 'Done' });
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PUT').at(-1)?.body).toMatchObject({ status: 'Planned' }));
  });

  it('offers no status change to someone who can’t edit the idea, and copies its link', async () => {
    const user = userEvent.setup();
    const readOnly = { ...launch, canEdit: false, role: 'Viewer' as const };
    fakeApi({ ...routes, [`${ideasRoute}?search=spring`]: { status: 200, body: [readOnly] }, 'GET /api/v1/ideas/idea-1': { status: 200, body: readOnly } });
    renderApp('/ideas');
    await findSpringLaunch();

    await user.keyboard('{Tab}');
    const actions = await screen.findByRole('group', { name: 'Actions for Spring launch' });
    await waitFor(() => expect(within(actions).getAllByRole('option').map((o) => o.textContent)).toEqual(['Open', 'Open in side panel', 'Copy link']));
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(await screen.findByText('Copied the link to “Spring launch”')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/ideas/idea-1`);
  });

  it('opens a recent idea in the side panel', async () => {
    localStorage.setItem('ideaverse.recentIdeas', JSON.stringify([{ id: 'idea-1', workspaceId: 'ws-1', title: 'Spring launch' }]));
    fakeApi(routes);
    const router = renderApp('/ideas');
    await ready();

    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.keyboard('{Tab}{ArrowDown}{Enter}');

    expect(await screen.findByRole('dialog', { name: 'Spring launch' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ideas');
    expect(router.state.location.search).toBe('?idea=idea-1');
  });

  it('goes back to the search with Shift+Tab or Escape, keeping what was typed', async () => {
    fakeApi(routes);
    renderApp('/ideas');
    const input = await findSpringLaunch();

    await userEvent.keyboard('{Tab}');
    expect(await screen.findByRole('group', { name: 'Actions for Spring launch' })).toBeInTheDocument();
    expect(input).toHaveValue('');
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(input).toHaveValue('spring');
    expect(await screen.findByRole('group', { name: 'Ideas' })).toBeInTheDocument();

    await userEvent.keyboard('{Tab}');
    await screen.findByRole('group', { name: 'Actions for Spring launch' });
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Search and commands' })).toBeInTheDocument();
    expect(input).toHaveValue('spring');
  });

  it('does nothing with Tab on an entry that isn’t an idea', async () => {
    fakeApi(routes);
    renderApp('/ideas');
    await ready();

    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.type(screen.getByRole('combobox', { name: 'Search ideas or type a command' }), 'go to');
    await userEvent.keyboard('{Tab}');

    expect(screen.queryByRole('group', { name: /Actions for/ })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search ideas or type a command' })).toHaveFocus();
  });
});
