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
