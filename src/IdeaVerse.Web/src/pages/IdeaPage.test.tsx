import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Component, Member } from '../api/types';
import { anIdea, fakeApi, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

const owner: Member = { userId: 'u-kat', email: 'kat@example.com', role: 'Owner', addedAt: '2026-10-01T09:00:00Z' };
const mia: Member = { userId: 'u-mia', email: 'mia@example.com', role: 'Member', addedAt: '2026-10-02T09:00:00Z' };
const budget: Component = {
  id: 'c-1',
  title: 'Budget sign-off',
  notes: null,
  isDone: false,
  position: 0,
  createdAt: '2026-10-01T09:00:00Z',
  completedAt: null,
};

function ideaRoutes(role: 'Owner' | 'Member', team: Member[]) {
  return {
    ...signedIn,
    'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea({ role, componentCount: 1 }) },
    'GET /api/v1/ideas/idea-1/components': { status: 200, body: [budget] },
    'GET /api/v1/ideas/idea-1/members': { status: 200, body: team },
  };
}

describe('IdeaPage', () => {
  it('lets the owner manage the team and delete the idea', async () => {
    fakeApi(ideaRoutes('Owner', [owner, mia]));

    renderApp('/ideas/idea-1');

    expect(await screen.findByRole('heading', { name: 'Black Friday teaser' })).toBeInTheDocument();
    expect(await screen.findByRole('form', { name: 'Add team member' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete idea' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('hides owner-only actions from a member but lets them leave', async () => {
    fakeApi({ ...ideaRoutes('Member', [owner, { ...mia, email: 'kat@example.com', userId: 'u-me' }]) });

    renderApp('/ideas/idea-1');

    expect(await screen.findByText('Only the owner can add or remove team members.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete idea' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Leave' })).toBeInTheDocument();
  });

  it('checks off a component and keeps it checked once saved', async () => {
    let saved = budget;
    const calls = fakeApi({
      ...ideaRoutes('Owner', [owner]),
      'GET /api/v1/ideas/idea-1/components': () => ({ status: 200, body: [saved] }),
      'PUT /api/v1/ideas/idea-1/components/c-1': (body) => {
        saved = { ...saved, ...(body as Partial<Component>) };
        return { status: 200, body: saved };
      },
    });
    renderApp('/ideas/idea-1');

    const checkbox = await screen.findByRole('checkbox', { name: /Budget sign-off/ });
    await userEvent.click(checkbox);

    await waitFor(() => expect(checkbox).toBeChecked());
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ title: 'Budget sign-off', notes: null, isDone: true }),
    );
  });

  it('unticks a component again when the API rejects the change', async () => {
    fakeApi({
      ...ideaRoutes('Owner', [owner]),
      'PUT /api/v1/ideas/idea-1/components/c-1': { status: 500, body: { title: 'Server error' } },
    });
    renderApp('/ideas/idea-1');

    const checkbox = await screen.findByRole('checkbox', { name: /Budget sign-off/ });
    await userEvent.click(checkbox);

    expect(await screen.findByRole('alert')).toHaveTextContent('Server error');
    await waitFor(() => expect(checkbox).not.toBeChecked());
  });

  it('postpones the idea to a later date', async () => {
    const calls = fakeApi({
      ...ideaRoutes('Owner', [owner]),
      'POST /api/v1/ideas/idea-1/postpone': (body) => ({ status: 200, body: anIdea({ ...(body as object), status: 'Postponed', postponeCount: 1 }) }),
    });
    renderApp('/ideas/idea-1');

    const form = await screen.findByRole('form', { name: 'Postpone idea' });
    const date = within(form).getByLabelText('New date');
    await userEvent.clear(date);
    await userEvent.type(date, '2099-12-31');
    await userEvent.click(within(form).getByRole('button', { name: 'Postpone' }));

    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/postpone'))?.body).toEqual({ targetDate: '2099-12-31' }));
  });

  it('explains when the idea is missing or not shared', async () => {
    fakeApi({ ...signedIn, 'GET /api/v1/ideas/nope': { status: 404 } });

    renderApp('/ideas/nope');

    expect(await screen.findByText(/doesn’t exist or isn’t shared with you/)).toBeInTheDocument();
  });

  it('shows the API message when adding an unregistered teammate', async () => {
    fakeApi({
      ...ideaRoutes('Owner', [owner]),
      'POST /api/v1/ideas/idea-1/members': {
        status: 400,
        body: { errors: { email: ['No IdeaVerse account uses this email. Ask them to sign up first.'] } },
      },
    });
    renderApp('/ideas/idea-1');

    const form = await screen.findByRole('form', { name: 'Add team member' });
    await userEvent.type(within(form).getByLabelText('Add a teammate by email'), 'new@example.com');
    await userEvent.click(within(form).getByRole('button', { name: 'Add' }));

    expect(await within(form).findByText(/Ask them to sign up first/)).toBeInTheDocument();
  });
});
