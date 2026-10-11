import { createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Component, Idea } from '../api/types';
import { anIdea, fakeApi, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

function aComponent(id: string, title: string, position: number): Component {
  return {
    id,
    title,
    notes: null,
    isDone: false,
    position,
    createdAt: '2026-10-01T09:00:00Z',
    completedAt: null,
    assigneeId: null,
    assigneeEmail: null,
    assigneeName: null,
    dueDate: null,
  };
}

const budget = aComponent('c-1', 'Budget', 0);
const designer = aComponent('c-2', 'Designer', 1);
const venue = aComponent('c-3', 'Venue', 2);

/** Routes for the idea page that keep the components' order as the server would. */
function ideaRoutes(idea: Idea = anIdea({ componentCount: 3 })) {
  let components = [budget, designer, venue];
  return {
    ...signedIn,
    'GET /api/v1/ideas/idea-1': { status: 200, body: idea },
    'GET /api/v1/ideas/idea-1/components': () => ({ status: 200, body: components }),
    'GET /api/v1/ideas/idea-1/comments': { status: 200, body: [] },
    'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
    'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
    'PUT /api/v1/ideas/idea-1/components/order': (body: unknown) => {
      const ids = (body as { componentIds: string[] }).componentIds;
      components = ids.map((id, position) => ({ ...components.find((c) => c.id === id)!, position }));
      return { status: 200, body: components };
    },
    'PUT /api/v1/ideas/idea-1/components/c-1': (body: unknown) => {
      components = components.map((c) => (c.id === 'c-1' ? { ...c, ...(body as Partial<Component>) } : c));
      return { status: 200, body: components.find((c) => c.id === 'c-1') };
    },
  };
}

const titles = () => within(screen.getByRole('region', { name: 'What it needs' })).getAllByRole('listitem').map((li) => li.querySelector('.check-title')?.textContent);

describe('Reordering components', () => {
  it('moves a component with the arrow keys on its handle, keeping focus and announcing it', async () => {
    const calls = fakeApi(ideaRoutes());
    renderApp('/ideas/idea-1');

    await screen.findByText('Venue', {}, { timeout: 5000 });
    const handle = screen.getByRole('button', { name: 'Move Venue' });
    handle.focus();
    await userEvent.keyboard('{ArrowUp}');

    await waitFor(() => expect(titles()).toEqual(['Budget', 'Venue', 'Designer']));
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ componentIds: ['c-1', 'c-3', 'c-2'] });
    expect(screen.getByText('Moved “Venue” to position 2 of 3.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Move Venue' })).toHaveFocus());
  });

  it('moves a component dropped on another row to that row’s place', async () => {
    const calls = fakeApi(ideaRoutes());
    renderApp('/ideas/idea-1');
    await screen.findByRole('button', { name: 'Move Budget' });

    const [first, , last] = within(screen.getByRole('region', { name: 'What it needs' })).getAllByRole('listitem') as [HTMLElement, HTMLElement, HTMLElement];
    const data = new Map<string, string>();
    const transfer = {
      get types() {
        return [...data.keys()];
      },
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? '',
      effectAllowed: 'all',
      dropEffect: 'move',
    };
    for (const [target, type] of [
      [first, 'dragStart'],
      [last, 'dragOver'],
      [last, 'drop'],
      [first, 'dragEnd'],
    ] as const) {
      const event = createEvent[type](target);
      Object.defineProperty(event, 'dataTransfer', { value: transfer });
      fireEvent(target, event);
    }

    await waitFor(() => expect(titles()).toEqual(['Designer', 'Venue', 'Budget']));
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ componentIds: ['c-2', 'c-3', 'c-1'] });
  });

  it('leaves focus alone after an arrow key at the end of the list', async () => {
    const calls = fakeApi(ideaRoutes());
    renderApp('/ideas/idea-1');

    const handle = await screen.findByRole('button', { name: 'Move Budget' });
    handle.focus();
    await userEvent.keyboard('{ArrowUp}');
    const checkbox = screen.getByRole('checkbox', { name: 'Designer' });
    await userEvent.click(checkbox);

    await waitFor(() => expect(calls.some((c) => c.method === 'PUT' && c.path.endsWith('/c-2'))).toBe(true));
    expect(calls.some((c) => c.path.endsWith('/order'))).toBe(false);
    expect(checkbox).toHaveFocus();
  });

  it('shows the server’s order and says so when a move is refused', async () => {
    fakeApi({ ...ideaRoutes(), 'PUT /api/v1/ideas/idea-1/components/order': { status: 400, body: { errors: { componentIds: ['List every component of the idea once.'] } } } });
    renderApp('/ideas/idea-1');

    const handle = await screen.findByRole('button', { name: 'Move Venue' });
    handle.focus();
    await userEvent.keyboard('{ArrowUp}');

    expect(await screen.findByText('Couldn’t save the new order. Try again.')).toBeInTheDocument();
    await waitFor(() => expect(titles()).toEqual(['Budget', 'Designer', 'Venue']));
  });

  it('offers no reordering to someone who cannot edit the idea', async () => {
    fakeApi(ideaRoutes(anIdea({ role: 'Viewer', canEdit: false, canManage: false })));
    renderApp('/ideas/idea-1');

    expect(await screen.findByText('Venue')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move Venue' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Venue' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument();
  });
});

describe('Editing a component in place', () => {
  it('renames it and keeps its other details', async () => {
    const calls = fakeApi(ideaRoutes());
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Budget' }));
    const form = screen.getByRole('form', { name: 'Edit Budget' });
    const title = within(form).getByLabelText('Title');
    expect(title).toHaveFocus();
    await userEvent.clear(title);
    await userEvent.type(title, 'Budget sign-off');
    await userEvent.type(within(form).getByLabelText(/Notes/), 'From finance');
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Budget sign-off')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PUT' && c.path.endsWith('/c-1'))?.body).toEqual({
      title: 'Budget sign-off',
      notes: 'From finance',
      isDone: false,
      assigneeId: null,
      dueDate: null,
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Budget sign-off' })).toHaveFocus());
  });

  it('keeps the form open when the title is refused', async () => {
    fakeApi({
      ...ideaRoutes(),
      'PUT /api/v1/ideas/idea-1/components/c-1': { status: 400, body: { errors: { title: ['The title is too long.'] } } },
    });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Budget' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('The title is too long.')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Edit Budget' })).toBeInTheDocument();
  });

  it('cancels with Escape', async () => {
    const calls = fakeApi(ideaRoutes());
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Budget' }));
    await userEvent.type(screen.getByLabelText('Title'), ' changed');
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('form', { name: 'Edit Budget' })).not.toBeInTheDocument();
    expect(screen.getByText('Budget')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
    expect(screen.getByRole('button', { name: 'Edit Budget' })).toHaveFocus();
  });
});

describe('Changing the status from the heading', () => {
  it('saves the new status and keeps the idea’s other details', async () => {
    const idea = anIdea({ tags: ['marketing'] });
    const calls = fakeApi({
      ...ideaRoutes(idea),
      'PUT /api/v1/ideas/idea-1': (body: unknown) => ({ status: 200, body: { ...idea, ...(body as object) } }),
    });
    renderApp('/ideas/idea-1');

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Status' }), 'Done');

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
        title: idea.title,
        description: idea.description,
        targetDate: idea.targetDate,
        status: 'Done',
        tags: ['marketing'],
      }),
    );
    expect(await screen.findByText('Status set to Done')).toBeInTheDocument();
  });

  it('says so when the status cannot be changed', async () => {
    fakeApi({ ...ideaRoutes(), 'PUT /api/v1/ideas/idea-1': { status: 500 } });
    renderApp('/ideas/idea-1');

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Status' }), 'Done');

    expect(await screen.findByText('Couldn’t change the status. Try again.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('Planned'));
  });
});
