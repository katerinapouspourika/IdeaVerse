import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { aWorkspace, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

const twoWorkspaces = {
  ...signedIn,
  'GET /api/v1/workspaces': {
    status: 200,
    body: [aWorkspace(), aWorkspace({ id: 'ws-2', name: 'Globex', role: 'Member', memberCount: 5 })],
  },
  [ideasRoute]: { status: 200, body: [] },
  'GET /api/v1/workspaces/ws-2/ideas': { status: 200, body: [] },
};

describe('Workspace menu', () => {
  it('lists each workspace with the user’s role, checks the current one, and sets New workspace apart', async () => {
    fakeApi(twoWorkspaces);
    renderApp('/ideas');

    const button = await screen.findByRole('button', { name: 'Workspace: Acme Marketing' });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    await userEvent.click(button);

    const menu = within(screen.getByRole('menu', { name: 'Workspaces' }));
    const [acme, globex] = menu.getAllByRole('menuitemradio');
    expect(acme).toBe(menu.getByRole('menuitemradio', { name: 'Acme Marketing, Owner' }));
    expect(globex).toBe(menu.getByRole('menuitemradio', { name: 'Globex, Member' }));
    expect(acme).toHaveAttribute('aria-checked', 'true');
    expect(globex).toHaveAttribute('aria-checked', 'false');
    expect(acme).toHaveFocus();
    expect(menu.getByRole('separator')).toBeInTheDocument();
    expect(menu.getByRole('menuitem', { name: 'New workspace' })).toBeInTheDocument();
  });

  it('switches from the keyboard, and Escape closes it without switching', async () => {
    fakeApi(twoWorkspaces);
    renderApp('/ideas');

    const button = await screen.findByRole('button', { name: 'Workspace: Acme Marketing' });
    button.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'New workspace' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: /Globex/ })).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    expect(await screen.findByRole('button', { name: 'Workspace: Globex' })).toHaveFocus();
    expect(localStorage.getItem('ideaverse.workspace')).toBe('ws-2');
  });

  it('starts a new workspace only from its own item', async () => {
    fakeApi(twoWorkspaces);
    const router = renderApp('/ideas');

    await userEvent.click(await screen.findByRole('button', { name: 'Workspace: Acme Marketing' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'New workspace' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/workspaces/new'));
  });
});
