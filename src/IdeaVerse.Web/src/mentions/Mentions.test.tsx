import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Comment, WorkspaceMember } from '../api/types';
import { anIdea, fakeApi, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { mentionLabels, segments, toBody, toEditable } from './mentions';

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

  it('chooses with Tab, wraps with ArrowUp, and announces the highlighted person', async () => {
    fakeApi(routes([]));
    renderApp('/ideas/idea-1');

    const box = await screen.findByLabelText('Add a comment');
    await userEvent.type(box, '@');
    expect(await screen.findByText('Mia Chen, 1 of 2. Use the arrow keys to choose and Enter to mention.')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByText('Leo, 2 of 2. Use the arrow keys to choose and Enter to mention.')).toBeInTheDocument();
    await userEvent.keyboard('{Tab}');

    expect(box).toHaveValue('@Leo ');
    expect(box).toHaveFocus();
  });

  it('says so when mentions make the comment too long', async () => {
    const calls = fakeApi(routes([]));
    renderApp('/ideas/idea-1');

    const box = await screen.findByLabelText('Add a comment');
    await userEvent.click(box);
    await userEvent.paste('a'.repeat(3990) + ' @');
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));

    expect(await screen.findByText('This comment is too long once its mentions are saved. Shorten it a little.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
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

  it('takes a $ in a name literally', () => {
    expect(toBody('Hi @Bob $&', [{ userId: 'u-1', name: "Bob $&" }])).toBe('Hi @[Bob $&](u-1)');
  });

  it('tells apart people who share a name, as the API does', () => {
    const labels = mentionLabels([
      { userId: 'u-1', name: 'Alex', email: 'alex@a.com' },
      { userId: 'u-2', name: 'alex', email: 'alex@b.com' },
      { userId: 'u-3', name: null, email: 'kim@c.com' },
      { userId: 'u-4', name: 'Jo [ops]', email: 'jo@d.com' },
    ]);
    const mentions = [
      { userId: 'u-1', name: labels.get('u-1')! },
      { userId: 'u-2', name: labels.get('u-2')! },
    ];

    expect([...labels.values()]).toEqual(['Alex (alex@a.com)', 'alex (alex@b.com)', 'kim@c.com', 'Jo ops']);
    expect(toBody('@Alex (alex@a.com) and @alex (alex@b.com)', mentions)).toBe('@[Alex (alex@a.com)](u-1) and @[alex (alex@b.com)](u-2)');
  });

  it('splits saved text into text and mentions', () => {
    expect(segments('a @[B](u-1) c')).toEqual([{ text: 'a ' }, { mention: { name: 'B', userId: 'u-1' } }, { text: ' c' }]);
  });
});
