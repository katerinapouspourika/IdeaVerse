import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Comment, WorkspaceMember } from '../api/types';
import { anIdea, fakeApi, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { segments, toBody, toEditable } from './mentions';

const people: WorkspaceMember[] = [
  { userId: 'u-kat', email: 'kat@example.com', name: null, role: 'Owner', joinedAt: '2026-10-01T09:00:00Z' },
  { userId: 'u-mia', email: 'mia@example.com', name: 'Mia Chen', role: 'Member', joinedAt: '2026-10-01T09:00:00Z' },
  { userId: 'u-leo', email: 'leo@example.com', name: 'Leo', role: 'Member', joinedAt: '2026-10-01T09:00:00Z' },
];

const mine: Comment = {
  id: 'c-1',
  body: 'Ask @[Mia Chen](u-mia) about the venue',
  authorEmail: 'kat@example.com',
  authorName: null,
  createdAt: '2026-10-10T09:00:00Z',
  editedAt: null,
  canEdit: true,
  canDelete: true,
};

function routes(comments: Comment[]) {
  let saved = comments;
  return {
    ...signedIn,
    'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea() },
    'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
    'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
    'GET /api/v1/workspaces/ws-1/members': { status: 200, body: people },
    'GET /api/v1/ideas/idea-1/comments': () => ({ status: 200, body: saved }),
    'POST /api/v1/ideas/idea-1/comments': (body: unknown) => {
      const comment = { ...mine, id: 'c-9', body: (body as { body: string }).body };
      saved = [...saved, comment];
      return { status: 201, body: comment };
    },
    'PUT /api/v1/ideas/idea-1/comments/c-1': (body: unknown) => {
      saved = saved.map((c) => (c.id === 'c-1' ? { ...c, body: (body as { body: string }).body } : c));
      return { status: 200, body: saved.find((c) => c.id === 'c-1') };
    },
  };
}

describe('Mentions in the discussion', () => {
  it('offers people after @ and saves the chosen one as a mention', async () => {
    const calls = fakeApi(routes([]));
    renderApp('/ideas/idea-1');

    const box = await screen.findByLabelText('Add a comment');
    await userEvent.type(box, 'Thanks @mi');
    const list = await screen.findByRole('listbox', { name: 'People to mention' });
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['Mia Chen mia@example.com']);
    expect(within(list).queryByText('kat@example.com')).not.toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(box).toHaveValue('Thanks @Mia Chen ');
    await userEvent.type(box, 'for the venue!');
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ body: 'Thanks @[Mia Chen](u-mia) for the venue!' }));
  });

  it('leaves out a chosen person whose name was deleted', async () => {
    const calls = fakeApi(routes([]));
    renderApp('/ideas/idea-1');

    const box = await screen.findByLabelText('Add a comment');
    await userEvent.type(box, '@le');
    await userEvent.click(within(await screen.findByRole('listbox', { name: 'People to mention' })).getByRole('option', { name: /Leo/ }));
    await userEvent.clear(box);
    await userEvent.type(box, 'Never mind');
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ body: 'Never mind' }));
  });

  it('closes the list with Escape without leaving the box', async () => {
    fakeApi(routes([]));
    renderApp('/ideas/idea-1');

    const box = await screen.findByLabelText('Add a comment');
    await userEvent.type(box, '@m');
    await screen.findByRole('listbox', { name: 'People to mention' });
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('listbox', { name: 'People to mention' })).not.toBeInTheDocument();
    expect(box).toHaveFocus();
  });

  it('shows mentions in comments and keeps them when the comment is edited', async () => {
    const calls = fakeApi(routes([mine]));
    renderApp('/ideas/idea-1');

    const mention = await screen.findByText('@Mia Chen');
    expect(mention).toHaveClass('mention');
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const box = screen.getByLabelText('Comment');
    expect(box).toHaveValue('Ask @Mia Chen about the venue');
    await userEvent.type(box, ' and @leo');
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ body: 'Ask @[Mia Chen](u-mia) about the venue and @[Leo](u-leo) ' }),
    );
  });
});

describe('Mention text', () => {
  it('round-trips between saved and editable text', () => {
    const body = 'Hi @[Mia Chen](u-mia), and @[Mia](u-m2)!';
    const { text, mentions } = toEditable(body);

    expect(text).toBe('Hi @Mia Chen, and @Mia!');
    expect(toBody(text, mentions)).toBe(body);
  });

  it('does not take a longer word for a name', () => {
    expect(toBody('@Leonard and @Leo', [{ userId: 'u-leo', name: 'Leo' }])).toBe('@Leonard and @[Leo](u-leo)');
  });

  it('splits saved text into text and mentions', () => {
    expect(segments('a @[B](u-1) c')).toEqual([{ text: 'a ' }, { mention: { name: 'B', userId: 'u-1' } }, { text: ' c' }]);
  });
});
