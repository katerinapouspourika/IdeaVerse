import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ActivityEntry, Comment } from '../api/types';
import { anIdea, fakeApi, signedIn } from '../test/fakeApi';
import { confirmDialog } from '../test/dialog';
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
    await confirmDialog('Delete comment');

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
    const calls = fakeApi({
      ...routes([]),
      'GET /api/v1/ideas/idea-1/activity?page=1&pageSize=10': { status: 200, body: { items: entries, totalCount: 2, page: 1, pageSize: 10 } },
    });
    renderApp('/ideas/idea-1');

    const section = await screen.findByRole('region', { name: 'Activity' });
    expect(calls.some((c) => c.path.endsWith('/activity'))).toBe(false);
    await userEvent.click(within(section).getByRole('button', { name: 'Show' }));

    expect(await within(section).findByText('Mia ticked off “Budget”')).toBeInTheDocument();
    expect(within(section).getByText('kat@example.com created the idea')).toBeInTheDocument();
  });

  it('pages through a long history ten entries at a time', async () => {
    const entries: ActivityEntry[] = Array.from({ length: 23 }, (_, i) => ({
      id: `a-${i}`,
      kind: 'ComponentAdded',
      detail: `Item ${23 - i}`,
      actorEmail: 'mia@example.com',
      actorName: 'Mia',
      createdAt: '2026-10-10T09:00:00Z',
    }));
    const page = (n: number) => ({ status: 200, body: { items: entries.slice((n - 1) * 10, n * 10), totalCount: 23, page: n, pageSize: 10 } });
    fakeApi({
      ...routes([]),
      'GET /api/v1/ideas/idea-1/activity?page=1&pageSize=10': page(1),
      'GET /api/v1/ideas/idea-1/activity?page=2&pageSize=10': page(2),
      'GET /api/v1/ideas/idea-1/activity?page=3&pageSize=10': page(3),
    });
    renderApp('/ideas/idea-1');

    const section = await screen.findByRole('region', { name: 'Activity' });
    await userEvent.click(within(section).getByRole('button', { name: 'Show' }));

    const pages = await within(section).findByRole('navigation', { name: 'Activity pages' });
    expect(within(section).getAllByRole('listitem')).toHaveLength(10);
    expect(within(section).getByText('Mia added “Item 23”')).toBeInTheDocument();
    expect(within(pages).getByText('Showing 1–10 of 23')).toBeInTheDocument();
    expect(within(pages).getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(within(pages).getByRole('button', { name: 'Next' }));
    expect(await within(pages).findByText('Showing 11–20 of 23')).toBeInTheDocument();
    expect(within(section).getByText('Mia added “Item 13”')).toBeInTheDocument();

    await userEvent.click(within(pages).getByRole('button', { name: 'Next' }));
    expect(await within(pages).findByText('Showing 21–23 of 23')).toBeInTheDocument();
    expect(within(section).getAllByRole('listitem')).toHaveLength(3);
    const next = within(pages).getByRole('button', { name: 'Next' });
    expect(next).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(next);
    expect(within(pages).getByText('Showing 21–23 of 23')).toBeInTheDocument();

    await userEvent.click(within(pages).getByRole('button', { name: 'Previous' }));
    expect(await within(pages).findByText('Showing 11–20 of 23')).toBeInTheDocument();

    await userEvent.click(within(section).getByRole('button', { name: 'Hide' }));
    expect(within(section).queryByRole('list')).not.toBeInTheDocument();
  });

  it('leaves out the page controls when the history fits on one page', async () => {
    const entries: ActivityEntry[] = [{ id: 'a-1', kind: 'Created', detail: null, actorEmail: 'kat@example.com', actorName: null, createdAt: '2026-10-10T09:00:00Z' }];
    fakeApi({
      ...routes([]),
      'GET /api/v1/ideas/idea-1/activity?page=1&pageSize=10': { status: 200, body: { items: entries, totalCount: 1, page: 1, pageSize: 10 } },
    });
    renderApp('/ideas/idea-1');

    const section = await screen.findByRole('region', { name: 'Activity' });
    await userEvent.click(within(section).getByRole('button', { name: 'Show' }));

    expect(await within(section).findByText('kat@example.com created the idea')).toBeInTheDocument();
    expect(within(section).queryByRole('navigation')).not.toBeInTheDocument();
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
