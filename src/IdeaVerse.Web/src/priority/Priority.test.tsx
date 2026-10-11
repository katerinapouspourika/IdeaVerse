import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Idea } from '../api/types';
import { anIdea, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

/** Routes that keep the idea's saved state, as the server does, so refetches after a change see it. */
function stored(idea: Idea) {
  let current = idea;
  return {
    get: () => ({ status: 200, body: current }),
    list: () => ({ status: 200, body: [current] }),
    save: (changes: Partial<Idea>) => () => {
      current = { ...current, ...changes };
      return { status: 200, body: current };
    },
    saveBody: (body: unknown) => {
      current = { ...current, ...(body as Partial<Idea>) };
      return { status: 200, body: current };
    },
  };
}

function ideaRoutes(idea: Idea | ReturnType<typeof stored>) {
  return {
    ...signedIn,
    'GET /api/v1/ideas/idea-1': 'get' in idea ? idea.get : { status: 200, body: idea },
    'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
    'GET /api/v1/ideas/idea-1/comments': { status: 200, body: [] },
    'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
    'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
  };
}

describe('Voting', () => {
  it('votes for an idea from the list and shows the new count', async () => {
    const launch = stored(anIdea({ title: 'Spring launch', voteCount: 2 }));
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: launch.list,
      'PUT /api/v1/ideas/idea-1/vote': launch.save({ voteCount: 3, hasVoted: true }),
    });
    renderApp('/ideas');

    await userEvent.click(await screen.findByRole('button', { name: 'Vote for Spring launch, 2 votes' }));

    const vote = await screen.findByRole('button', { name: 'Vote for Spring launch, 3 votes' });
    expect(vote).toHaveAttribute('aria-pressed', 'true');
    expect(calls.some((c) => c.method === 'PUT' && c.path === '/api/v1/ideas/idea-1/vote')).toBe(true);
  });

  it('withdraws a vote already cast', async () => {
    const launch = stored(anIdea({ title: 'Spring launch', voteCount: 1, hasVoted: true }));
    const calls = fakeApi({
      ...ideaRoutes(launch),
      'DELETE /api/v1/ideas/idea-1/vote': launch.save({ voteCount: 0, hasVoted: false }),
    });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'Vote for Spring launch, 1 vote' }));

    expect(await screen.findByRole('button', { name: 'Vote for Spring launch, 0 votes' })).toHaveAttribute('aria-pressed', 'false');
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/v1/ideas/idea-1/vote')).toBe(true);
  });
});

describe('Impact and effort', () => {
  it('saves a score as soon as it is picked and places the idea on the matrix', async () => {
    const idea = stored(anIdea({ impact: 4 }));
    const calls = fakeApi({
      ...ideaRoutes(idea),
      'PUT /api/v1/ideas/idea-1/priority': idea.saveBody,
    });
    renderApp('/ideas/idea-1');

    const priority = await screen.findByRole('region', { name: 'Priority' });
    expect(within(priority).getByText('Score impact and effort to place it on the matrix.')).toBeInTheDocument();
    await userEvent.selectOptions(within(priority).getByLabelText('Effort'), '2');

    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ impact: 4, effort: 2 }));
    expect(await within(priority).findByText('Quick wins')).toBeInTheDocument();
  });

  it('shows scores without controls to someone who cannot edit the idea', async () => {
    fakeApi(ideaRoutes(anIdea({ role: 'Viewer', canEdit: false, canManage: false, impact: 2, effort: 5 })));
    renderApp('/ideas/idea-1');

    const priority = await screen.findByRole('region', { name: 'Priority' });

    expect(within(priority).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(priority).getByText('5 · Very high')).toBeInTheDocument();
    expect(within(priority).getByText('Time sinks')).toBeInTheDocument();
  });

  it('sorts the list by votes or by impact for effort', async () => {
    const calls = fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [anIdea()] } });
    renderApp('/ideas');

    await userEvent.selectOptions(await screen.findByLabelText('Sort by'), 'Impact for effort');

    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/ideas?sort=Priority'))).toBe(true));
  });
});

describe('Matrix view', () => {
  it('places scored ideas in their quadrant and lists the rest as not scored', async () => {
    fakeApi({
      ...signedIn,
      [ideasRoute]: {
        status: 200,
        body: [
          anIdea({ id: 'idea-1', title: 'Newsletter', impact: 5, effort: 1 }),
          anIdea({ id: 'idea-2', title: 'New app', impact: 5, effort: 5 }),
          anIdea({ id: 'idea-3', title: 'Sticker pack', impact: 1, effort: 1 }),
          anIdea({ id: 'idea-4', title: 'Rewrite site', impact: 2, effort: 4 }),
          anIdea({ id: 'idea-5', title: 'Podcast' }),
        ],
      },
    });
    renderApp('/ideas');

    await userEvent.click(await screen.findByRole('button', { name: 'Matrix' }));

    expect(within(screen.getByRole('region', { name: /Quick wins/ })).getByRole('link', { name: 'Newsletter' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Big bets/ })).getByRole('link', { name: 'New app' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Nice to haves/ })).getByRole('link', { name: 'Sticker pack' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Time sinks/ })).getByRole('link', { name: 'Rewrite site' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Not scored yet/ })).getByRole('link', { name: 'Podcast' })).toBeInTheDocument();
  });
});
