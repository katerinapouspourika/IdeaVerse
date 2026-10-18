import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Component } from '../api/types';
import { anIdea, aWorkspace, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

describe('Header', () => {
  it('signs out from the account menu', async () => {
    let signedOut = false;
    fakeApi({
      ...signedIn,
      'GET /api/v1/account': () => (signedOut ? { status: 401 } : signedIn['GET /api/v1/account']),
      'POST /api/v1/auth/logout': () => {
        signedOut = true;
        return { status: 200 };
      },
      [ideasRoute]: { status: 200, body: [] },
    });
    const router = renderApp('/ideas');

    await userEvent.click(await screen.findByRole('button', { name: 'Account: kat@example.com' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('picks light, dark, or the device’s colour scheme from a menu, and remembers the choice', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/ideas');
    await screen.findByRole('button', { name: 'Account: kat@example.com' });

    await userEvent.click(screen.getByRole('button', { name: 'Theme: light (matches device)' }));
    expect(screen.getByRole('menuitemradio', { name: 'Match device' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('ideaverse.theme')).toBe('dark');

    await userEvent.click(screen.getByRole('button', { name: 'Theme: dark' }));
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Light' }));
    expect(document.documentElement.dataset.theme).toBe('light');

    await userEvent.click(screen.getByRole('button', { name: 'Theme: light' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Match device' }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem('ideaverse.theme')).toBeNull();
  });

  it('offers a link that skips straight to the page content', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/ideas');

    expect(await screen.findByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });
});

describe('Getting started', () => {
  it('lists the first steps, ticking off the ones already done, until hidden', async () => {
    fakeApi({
      ...signedIn,
      'GET /api/v1/workspaces': { status: 200, body: [aWorkspace({ memberCount: 1 })] },
      [ideasRoute]: { status: 200, body: [anIdea({ componentCount: 0 })] },
    });
    renderApp('/');

    const checklist = await screen.findByRole('region', { name: 'Get started' });
    expect(within(checklist).getByText('2 of 5 done')).toBeInTheDocument();
    expect(within(checklist).getByRole('link', { name: 'Invite a teammate' })).toHaveAttribute('href', '/people');
    expect(within(checklist).queryByRole('link', { name: 'Add your first idea' })).not.toBeInTheDocument();

    await userEvent.click(within(checklist).getByRole('button', { name: 'Hide getting started' }));

    expect(screen.queryByRole('region', { name: 'Get started' })).not.toBeInTheDocument();
    expect(localStorage.getItem('ideaverse.getting-started.hidden.ws-1')).toBe('1');
  });

  it('gives a member who joined someone else’s workspace only their own steps', async () => {
    fakeApi({
      ...signedIn,
      'GET /api/v1/workspaces': { status: 200, body: [aWorkspace({ role: 'Member', memberCount: 3 })] },
      [ideasRoute]: { status: 200, body: [anIdea({ role: 'Member', ownerEmail: 'leo@example.com', componentCount: 4 })] },
    });
    renderApp('/');

    const checklist = await screen.findByRole('region', { name: 'Get started' });
    expect(within(checklist).getByText('0 of 3 done')).toBeInTheDocument();
    expect(within(checklist).getByRole('link', { name: 'Add your first idea' })).toBeInTheDocument();
    expect(within(checklist).getByRole('link', { name: 'List what your idea needs' })).toHaveAttribute('href', '/ideas');
    expect(within(checklist).queryByText(/Invite a teammate/)).not.toBeInTheDocument();
    expect(within(checklist).queryByText(/Create a workspace/)).not.toBeInTheDocument();
  });
});

describe('Removing a component', () => {
  const budget: Component = {
    id: 'c-1',
    title: 'Budget sign-off',
    notes: 'Ask finance',
    isDone: false,
    position: 0,
    createdAt: '2026-10-01T09:00:00Z',
    completedAt: null,
    assigneeId: 'u-mia',
    assigneeEmail: 'mia@example.com',
    assigneeName: null,
    dueDate: '2099-11-01',
  };

  it('removes it at once and puts it back, assignment included, on Undo', async () => {
    const calls = fakeApi({
      ...signedIn,
      'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea({ componentCount: 1 }) },
      'GET /api/v1/ideas/idea-1/components': { status: 200, body: [budget] },
      'GET /api/v1/ideas/idea-1/comments': { status: 200, body: [] },
      'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
      'DELETE /api/v1/ideas/idea-1/components/c-1': { status: 204 },
      'POST /api/v1/ideas/idea-1/components': { status: 201, body: { ...budget, id: 'c-2', assigneeId: null, dueDate: null } },
      'PUT /api/v1/ideas/idea-1/components/c-2': (body) => ({ status: 200, body: { ...budget, id: 'c-2', ...(body as object) } }),
    });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'More actions for Budget sign-off' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));
    expect(await screen.findByText('Removed “Budget sign-off”')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
        title: 'Budget sign-off',
        notes: 'Ask finance',
        isDone: false,
        assigneeId: 'u-mia',
        dueDate: '2099-11-01',
      }),
    );
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ title: 'Budget sign-off', notes: 'Ask finance' });
  });

  it('puts an undone component back in its old place', async () => {
    const venue: Component = { ...budget, id: 'c-2', title: 'Venue', position: 1, assigneeId: null, assigneeEmail: null, dueDate: null, notes: null };
    const designer: Component = { ...venue, id: 'c-3', title: 'Designer', position: 2 };
    let list = [budget, venue, designer];
    const calls = fakeApi({
      ...signedIn,
      'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea({ componentCount: 3 }) },
      'GET /api/v1/ideas/idea-1/components': () => ({ status: 200, body: list }),
      'GET /api/v1/ideas/idea-1/comments': { status: 200, body: [] },
      'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
      'DELETE /api/v1/ideas/idea-1/components/c-2': () => {
        list = [budget, designer];
        return { status: 204 };
      },
      'POST /api/v1/ideas/idea-1/components': () => {
        const restored = { ...venue, id: 'c-4', position: 2 };
        list = [budget, designer, restored];
        return { status: 201, body: restored };
      },
      'PUT /api/v1/ideas/idea-1/components/order': { status: 200, body: [] },
    });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'More actions for Venue' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/components/order'))?.body).toEqual({ componentIds: ['c-1', 'c-4', 'c-3'] }));
  });
});
