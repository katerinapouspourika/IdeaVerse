import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Component } from '../api/types';
import { anIdea, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

const launch = anIdea({ id: 'idea-1', title: 'Spring launch', description: 'Teasers and a launch post', tags: ['marketing'] });
const budget: Component = {
  id: 'c-1',
  title: 'Budget sign-off',
  notes: null,
  isDone: false,
  position: 0,
  createdAt: '2026-10-01T09:00:00Z',
  completedAt: null,
  assigneeId: null,
  assigneeEmail: null,
  assigneeName: null,
  dueDate: null,
};

const routes = {
  ...signedIn,
  [ideasRoute]: { status: 200, body: [launch] },
  'GET /api/v1/ideas/idea-1': { status: 200, body: launch },
  'GET /api/v1/ideas/idea-1/components': { status: 200, body: [budget] },
  'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
};

describe('Idea side panel', () => {
  it('opens an idea from the list without leaving it, and closes with Escape', async () => {
    fakeApi(routes);
    const router = renderApp('/ideas');

    const link = await screen.findByRole('link', { name: /Spring launch/ });
    await userEvent.click(link);

    const panel = await screen.findByRole('dialog', { name: 'Spring launch' });
    expect(router.state.location.pathname).toBe('/ideas');
    expect(router.state.location.search).toBe('?idea=idea-1');
    expect(within(panel).getByText('Teasers and a launch post')).toBeInTheDocument();
    expect(await within(panel).findByText('Budget sign-off')).toBeInTheDocument();
    expect(within(panel).getByRole('region', { name: 'Priority' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Close' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.search).toBe('');
    expect(screen.getByRole('link', { name: /Spring launch/ })).toHaveFocus();
  });

  it('opens from the address, and its close button clears it', async () => {
    fakeApi(routes);
    const router = renderApp('/ideas?idea=idea-1');

    const panel = await screen.findByRole('dialog', { name: 'Spring launch' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.search).toBe('');
  });

  it('links to the full page', async () => {
    fakeApi({ ...routes, 'GET /api/v1/ideas/idea-1/comments': { status: 200, body: [] }, 'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] } });
    const router = renderApp('/ideas?idea=idea-1');

    const panel = await screen.findByRole('dialog', { name: 'Spring launch' });
    await userEvent.click(within(panel).getByRole('link', { name: 'Open full page' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/ideas/idea-1'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Spring launch' })).toBeInTheDocument();
  });

  it('opens from the board and the matrix too', async () => {
    fakeApi(routes);
    renderApp('/ideas');

    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));
    await userEvent.click(screen.getByRole('link', { name: 'Spring launch' }));
    expect(await screen.findByRole('dialog', { name: 'Spring launch' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Matrix' }));
    await userEvent.click(screen.getByRole('link', { name: 'Spring launch' }));
    expect(await screen.findByRole('dialog', { name: 'Spring launch' })).toBeInTheDocument();
  });

  it('says so when the idea cannot be found, with no link to a page it has none of', async () => {
    fakeApi({ ...routes, 'GET /api/v1/ideas/idea-9': { status: 404 } });
    renderApp('/ideas?idea=idea-9');

    const panel = await screen.findByRole('dialog', { name: 'Idea unavailable' });

    expect(within(panel).getByText('This idea doesn’t exist or isn’t in one of your workspaces.')).toBeInTheDocument();
    expect(within(panel).queryByRole('link', { name: 'Open full page' })).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
