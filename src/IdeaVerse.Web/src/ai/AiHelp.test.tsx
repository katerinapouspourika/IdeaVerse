import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BrainstormedIdea, Component, ComponentSuggestion, IdeaImprovement } from '../api/types';
import { anIdea, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

const aiOn = { 'GET /api/v1/workspaces/ws-1/ai': { status: 200, body: { enabled: true, used: 3, limit: 50 } } };
const aiOff = { 'GET /api/v1/workspaces/ws-1/ai': { status: 200, body: { enabled: false, used: 0, limit: 50 } } };

const guestSeries: BrainstormedIdea = {
  title: 'Guest expert series',
  summary: 'A monthly webinar with an industry guest.',
  targetAudience: 'small agencies',
  differentiator: 'Borrowed authority.',
  score: 8,
  strengths: ['Credible'],
  weaknesses: ['Booking guests takes time.'],
};

function ideaRoutes(components: Component[] = []) {
  return {
    ...signedIn,
    ...aiOn,
    'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea() },
    'GET /api/v1/ideas/idea-1/components': { status: 200, body: components },
    'GET /api/v1/ideas/idea-1/comments': { status: 200, body: [] },
    'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
    'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
  };
}

describe('AI help', () => {
  it('brainstorms ideas and opens one as a new idea', async () => {
    const calls = fakeApi({
      ...signedIn,
      ...aiOn,
      [ideasRoute]: { status: 200, body: [] },
      'POST /api/v1/workspaces/ws-1/ai/brainstorm': { status: 200, body: [guestSeries] },
    });
    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Brainstorm with AI' }));
    const panel = screen.getByRole('region', { name: 'Brainstorm with AI' });
    expect(within(panel).getByText('47 of 50 AI requests left today for your workspace.')).toBeInTheDocument();
    await userEvent.type(within(panel).getByLabelText('What do you want ideas for?'), 'More webinar sign-ups');
    await userEvent.click(within(panel).getByRole('button', { name: 'Brainstorm' }));
    await userEvent.click(await within(panel).findByRole('button', { name: 'Add Guest expert series' }));

    const form = screen.getByRole('form', { name: 'New idea' });
    expect(within(form).getByLabelText('Title')).toHaveValue('Guest expert series');
    expect(within(form).getByLabelText(/Description/)).toHaveValue(
      'A monthly webinar with an industry guest.\n\nFor: small agencies\nWhy it stands out: Borrowed authority.',
    );
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ brief: 'More webinar sign-ups' });
  });

  it('adds only the suggested components the user keeps', async () => {
    const suggestions: ComponentSuggestion[] = [
      { title: 'Video editor', notes: 'Cuts the teasers' },
      { title: 'Posting calendar', notes: 'One a day' },
    ];
    const calls = fakeApi({
      ...ideaRoutes(),
      'POST /api/v1/ideas/idea-1/ai/components': { status: 200, body: suggestions },
      'POST /api/v1/ideas/idea-1/components': (body) => ({ status: 201, body: { id: 'c-9', isDone: false, position: 0, createdAt: '', completedAt: null, ...(body as object) } }),
    });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'Suggest with AI' }));
    const group = await screen.findByRole('group', { name: 'AI suggestions' });
    await userEvent.click(within(group).getByRole('checkbox', { name: /Posting calendar/ }));
    await userEvent.click(within(group).getByRole('button', { name: 'Add 1 selected' }));

    await waitFor(() => expect(screen.queryByRole('group', { name: 'AI suggestions' })).not.toBeInTheDocument());
    const added = calls.filter((c) => c.method === 'POST' && c.path === '/api/v1/ideas/idea-1/components');
    expect(added.map((c) => c.body)).toEqual([{ title: 'Video editor', notes: 'Cuts the teasers' }]);
  });

  it('shows the AI review and saves the suggested version', async () => {
    const improvement: IdeaImprovement = {
      strengths: ['Timely'],
      weaknesses: ['No measurable goal'],
      title: 'Black Friday countdown',
      description: 'Five daily TikToks building to the sale.',
    };
    const calls = fakeApi({
      ...ideaRoutes(),
      'POST /api/v1/ideas/idea-1/ai/improve': { status: 200, body: improvement },
      'PUT /api/v1/ideas/idea-1': (body) => ({ status: 200, body: anIdea(body as object) }),
    });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'Improve with AI' }));
    const review = await screen.findByRole('region', { name: 'AI review' });
    expect(within(review).getByText('No measurable goal')).toBeInTheDocument();
    await userEvent.click(within(review).getByRole('button', { name: 'Use this version' }));

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
        title: 'Black Friday countdown',
        description: 'Five daily TikToks building to the sale.',
        targetDate: '2099-11-27',
        status: 'Planned',
      }),
    );
  });

  it('explains when the workspace has used today’s requests', async () => {
    fakeApi({
      ...ideaRoutes(),
      'POST /api/v1/ideas/idea-1/ai/improve': {
        status: 429,
        body: { detail: 'Your workspace has used its 50 AI requests for today. More are available after midnight UTC.' },
      },
    });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'Improve with AI' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('used its 50 AI requests for today');
  });

  it('hides AI help when it isn’t set up', async () => {
    fakeApi({ ...signedIn, ...aiOff, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/');

    await screen.findByRole('heading', { name: 'Ideas' });
    expect(screen.queryByRole('button', { name: 'Brainstorm with AI' })).not.toBeInTheDocument();
  });

  it('hides AI help on an idea from people who can’t edit it', async () => {
    fakeApi({ ...ideaRoutes(), 'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea({ role: 'Viewer', canEdit: false, canManage: false }) } });
    renderApp('/ideas/idea-1');

    await screen.findByRole('heading', { name: 'Black Friday teaser' });
    expect(screen.queryByRole('button', { name: 'Improve with AI' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suggest with AI' })).not.toBeInTheDocument();
  });
});
