import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Idea } from '../api/types';
import { anIdea, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { narrowScreen } from '../test/narrowScreen';
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

  it('shows an archived idea’s votes without letting anyone vote', async () => {
    fakeApi(ideaRoutes(anIdea({ title: 'Spring launch', voteCount: 4, archivedAt: '2099-01-01T00:00:00Z' })));
    renderApp('/ideas/idea-1');

    expect(await screen.findByRole('img', { name: '4 votes' })).toHaveAttribute('title', 'Archived ideas can’t be voted on');
    expect(screen.queryByRole('button', { name: /Vote for/ })).not.toBeInTheDocument();
  });

  it('puts the vote beside the idea’s title rather than in the Priority card', async () => {
    fakeApi(ideaRoutes(anIdea({ title: 'Spring launch', voteCount: 4 })));
    renderApp('/ideas/idea-1');

    const title = await screen.findByRole('heading', { level: 1, name: 'Spring launch' });
    const vote = screen.getByRole('button', { name: 'Vote for Spring launch, 4 votes' });
    expect(title.parentElement).toContainElement(vote);
    expect(within(screen.getByRole('region', { name: 'Priority' })).queryByRole('button', { name: /Vote for/ })).not.toBeInTheDocument();
  });

  it('votes from beside the title in the side panel', async () => {
    const launch = stored(anIdea({ title: 'Spring launch', voteCount: 0 }));
    fakeApi({
      ...ideaRoutes(launch),
      [ideasRoute]: launch.list,
      'PUT /api/v1/ideas/idea-1/vote': launch.save({ voteCount: 1, hasVoted: true }),
    });
    renderApp('/ideas?idea=idea-1');

    const panel = await screen.findByRole('dialog', { name: 'Spring launch' });
    const title = within(panel).getByRole('heading', { name: 'Spring launch' });
    expect(title.parentElement).toContainElement(within(panel).getByRole('button', { name: 'Vote for Spring launch, 0 votes' }));
    expect(within(within(panel).getByRole('region', { name: 'Priority' })).queryByRole('button', { name: /Vote for/ })).not.toBeInTheDocument();

    await userEvent.click(within(panel).getByRole('button', { name: 'Vote for Spring launch, 0 votes' }));

    expect(await within(panel).findByRole('button', { name: 'Vote for Spring launch, 1 vote' })).toHaveAttribute('aria-pressed', 'true');
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

  it('calls a medium effort of 3 balanced rather than a big bet', async () => {
    fakeApi(ideaRoutes(anIdea({ role: 'Viewer', canEdit: false, canManage: false, impact: 5, effort: 3 })));
    renderApp('/ideas/idea-1');

    const priority = await screen.findByRole('region', { name: 'Priority' });

    expect(within(priority).getByText('Balanced')).toBeInTheDocument();
    expect(within(priority).queryByText('Big bets')).not.toBeInTheDocument();
  });

  it('sorts the list by votes or by impact for effort', async () => {
    const calls = fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [anIdea()] } });
    renderApp('/ideas');

    await userEvent.selectOptions(await screen.findByLabelText('Sort by'), 'Impact for effort');

    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/ideas?sort=Priority'))).toBe(true));
  });
});

describe('Matrix view', () => {
  const showMatrix = async (ideas: Idea[], routes = {}) => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: ideas }, ...routes });
    const router = renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Matrix' }));
    return router;
  };

  it('places each scored idea in the cell of its scores, in its quadrant, and lists the rest as not scored', async () => {
    await showMatrix([
      anIdea({ id: 'idea-1', title: 'Newsletter', impact: 5, effort: 1 }),
      anIdea({ id: 'idea-2', title: 'New app', impact: 4, effort: 5 }),
      anIdea({ id: 'idea-3', title: 'Sticker pack', impact: 1, effort: 2 }),
      anIdea({ id: 'idea-4', title: 'Rewrite site', impact: 2, effort: 4 }),
      anIdea({ id: 'idea-5', title: 'Podcast' }),
    ]);

    const matrix = screen.getByRole('group', { name: 'Impact and effort matrix' });
    expect(within(matrix).getByRole('group', { name: 'Impact 5, effort 1, Quick wins' })).toContainElement(screen.getByRole('link', { name: 'Newsletter' }));
    expect(within(matrix).getByRole('group', { name: 'Impact 4, effort 5, Big bets' })).toContainElement(screen.getByRole('link', { name: 'New app' }));
    expect(within(matrix).getByRole('group', { name: 'Impact 1, effort 2, Nice to haves' })).toContainElement(screen.getByRole('link', { name: 'Sticker pack' }));
    expect(within(matrix).getByRole('group', { name: 'Impact 2, effort 4, Time sinks' })).toContainElement(screen.getByRole('link', { name: 'Rewrite site' }));
    // Only cells with ideas are named groups.
    expect(within(matrix).getAllByRole('group')).toHaveLength(4);
    expect(within(screen.getByRole('region', { name: /Not scored yet/ })).getByRole('link', { name: 'Podcast' })).toBeInTheDocument();
  });

  it('puts ideas with a medium 3 on the grid’s neutral centre rather than in a separate list', async () => {
    await showMatrix([
      anIdea({ id: 'idea-1', title: 'Newsletter', impact: 5, effort: 3 }),
      anIdea({ id: 'idea-2', title: 'Sticker pack', impact: 3, effort: 1 }),
      anIdea({ id: 'idea-3', title: 'Rewrite site', impact: 3, effort: 3 }),
    ]);

    expect(screen.getByRole('group', { name: 'Impact 5, effort 3' })).toContainElement(screen.getByRole('link', { name: 'Newsletter' }));
    expect(screen.getByRole('group', { name: 'Impact 3, effort 1' })).toContainElement(screen.getByRole('link', { name: 'Sticker pack' }));
    expect(screen.getByRole('group', { name: 'Impact 3, effort 3' })).toContainElement(screen.getByRole('link', { name: 'Rewrite site' }));
    expect(screen.queryByRole('region', { name: /Balanced/ })).not.toBeInTheDocument();
  });

  it('folds a crowded cell behind a button that shows the rest', async () => {
    await showMatrix(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map((title, i) => anIdea({ id: `idea-${i}`, title, impact: 4, effort: 2 })));

    const cell = screen.getByRole('group', { name: 'Impact 4, effort 2, Quick wins' });
    expect(within(cell).getAllByRole('link').map((l) => l.textContent)).toEqual(['Alpha', 'Bravo']);

    const more = within(cell).getByRole('button', { name: 'Show 3 more ideas at impact 4, effort 2' });
    expect(more).toHaveTextContent('+3');
    await userEvent.click(more);

    expect(within(cell).getAllByRole('link').map((l) => l.textContent)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
    expect(within(cell).getByRole('button', { name: 'Show fewer ideas at impact 4, effort 2' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens an idea in the side panel from its chip', async () => {
    const idea = anIdea({ id: 'idea-1', title: 'Newsletter', impact: 5, effort: 1 });
    const router = await showMatrix([idea], {
      'GET /api/v1/ideas/idea-1': { status: 200, body: idea },
      'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
    });

    await userEvent.click(screen.getByRole('link', { name: 'Newsletter' }));

    expect(await screen.findByRole('dialog', { name: 'Newsletter' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?idea=idea-1');
  });

  it('lists the ideas by quadrant with their scores on a phone, the centre ones as balanced', async () => {
    narrowScreen();
    await showMatrix([
      anIdea({ id: 'idea-1', title: 'Newsletter', impact: 5, effort: 1 }),
      anIdea({ id: 'idea-2', title: 'Rewrite site', impact: 2, effort: 4 }),
      anIdea({ id: 'idea-3', title: 'Sticker pack', impact: 3, effort: 1 }),
      anIdea({ id: 'idea-4', title: 'Podcast' }),
    ]);

    expect(screen.queryByRole('group', { name: 'Impact and effort matrix' })).not.toBeInTheDocument();
    const quickWins = screen.getByRole('region', { name: /Quick wins/ });
    expect(within(quickWins).getByRole('link', { name: 'Newsletter' })).toBeInTheDocument();
    expect(within(quickWins).getByText('impact 5 · effort 1')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Time sinks/ })).getByRole('link', { name: 'Rewrite site' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Balanced/ })).getByRole('link', { name: 'Sticker pack' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Big bets/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Not scored yet/ })).getByRole('link', { name: 'Podcast' })).toBeInTheDocument();
  });
});
