import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ActivityEntry, Comment } from '../api/types';
import { anIdea, fakeApi, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { describeActivity } from './ActivitySection';

const mine: Comment = {
  id: 'c-1',
  body: 'Frist idea',
  authorEmail: 'kat@example.com',
  authorName: null,
  createdAt: '2026-10-10T09:00:00Z',
  editedAt: null,
  canEdit: true,
  canDelete: true,
};
const orphan: Comment = { ...mine, id: 'c-2', body: 'Old note', authorEmail: null, canEdit: false, canDelete: false };

function routes(comments: Comment[]) {
  return {
    ...signedIn,
    'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea() },
    'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
    'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
    'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
    'GET /api/v1/ideas/idea-1/comments': { status: 200, body: comments },
  };
}

describe('Discussion', () => {
  it('posts a comment', async () => {
    let comments: Comment[] = [];
    const calls = fakeApi({
      ...routes([]),
      'GET /api/v1/ideas/idea-1/comments': () => ({ status: 200, body: comments }),
      'POST /api/v1/ideas/idea-1/comments': (body) => {
        comments = [{ ...mine, body: (body as { body: string }).body }];
        return { status: 201, body: comments[0] };
      },
    });
    renderApp('/ideas/idea-1');

    const form = await screen.findByRole('form', { name: 'Add comment' });
    await userEvent.type(within(form).getByLabelText('Add a comment'), 'Let’s do it');
    await userEvent.click(within(form).getByRole('button', { name: 'Comment' }));

    const discussion = screen.getByRole('region', { name: 'Discussion' });
    expect(await within(discussion).findByText('Let’s do it')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ body: 'Let’s do it' });
    expect(within(form).getByLabelText('Add a comment')).toHaveValue('');
  });

  it('edits and deletes your own comment, and shows a former member’s without actions', async () => {
    const calls = fakeApi({
      ...routes([mine, orphan]),
      'PUT /api/v1/ideas/idea-1/comments/c-1': (body) => ({ status: 200, body: { ...mine, ...(body as object), editedAt: '2026-10-10T10:00:00Z' } }),
      'DELETE /api/v1/ideas/idea-1/comments/c-1': { status: 204 },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('/ideas/idea-1');

    const discussion = await screen.findByRole('region', { name: 'Discussion' });
    expect(await within(discussion).findByText('A former member')).toBeInTheDocument();
    expect(within(discussion).getAllByRole('button', { name: 'Edit' })).toHaveLength(1);

    await userEvent.click(within(discussion).getByRole('button', { name: 'Edit' }));
    const edit = within(discussion).getByRole('form', { name: 'Edit comment' });
    await userEvent.clear(within(edit).getByLabelText('Comment'));
    await userEvent.type(within(edit).getByLabelText('Comment'), 'First idea');
    await userEvent.click(within(edit).getByRole('button', { name: 'Save' }));
    await userEvent.click(within(discussion).getByRole('button', { name: 'Delete comment by kat@example.com' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ body: 'First idea' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
  });
});

describe('Activity', () => {
  it('loads the history when opened', async () => {
    const entries: ActivityEntry[] = [
      { id: 'a-2', kind: 'ComponentCompleted', detail: 'Budget', actorEmail: 'mia@example.com', actorName: 'Mia', createdAt: '2026-10-10T10:00:00Z' },
      { id: 'a-1', kind: 'Created', detail: null, actorEmail: 'kat@example.com', actorName: null, createdAt: '2026-10-10T09:00:00Z' },
    ];
    const calls = fakeApi({ ...routes([]), 'GET /api/v1/ideas/idea-1/activity': { status: 200, body: entries } });
    renderApp('/ideas/idea-1');

    const section = await screen.findByRole('region', { name: 'Activity' });
    expect(calls.some((c) => c.path.endsWith('/activity'))).toBe(false);
    await userEvent.click(within(section).getByRole('button', { name: 'Show' }));

    expect(await within(section).findByText('Mia ticked off “Budget”')).toBeInTheDocument();
    expect(within(section).getByText('kat@example.com created the idea')).toBeInTheDocument();
  });

  it.each<[ActivityEntry['kind'], string | null, string]>([
    ['StatusChanged', 'InProgress', 'Mia set the status to In progress'],
    ['Postponed', '2026-11-20', 'Mia postponed it to'],
    ['MemberLeft', null, 'Mia left the team'],
    ['MemberAdded', 'Leo', 'Mia added Leo to the team'],
  ])('describes %s', (kind, detail, expected) => {
    const sentence = describeActivity({ id: 'x', kind, detail, actorEmail: 'mia@example.com', actorName: 'Mia', createdAt: '2026-10-10T09:00:00Z' });
    expect(sentence).toContain(expected);
  });
});
