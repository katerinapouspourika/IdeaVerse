import { createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { anIdea, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

const launch = anIdea({ id: 'idea-1', title: 'Spring launch', status: 'Planned', tags: ['marketing'] });
const offsite = anIdea({ id: 'idea-2', title: 'Team offsite', status: 'InProgress' });
const readOnly = anIdea({ id: 'idea-3', title: 'Leo’s podcast', status: 'Done', role: 'Viewer', canEdit: false, canManage: false });

/** A drag-and-drop data transfer that carries values between the drag start and the drop, as a browser does. */
function dataTransfer() {
  const data = new Map<string, string>();
  return {
    get types() {
      return [...data.keys()];
    },
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? '',
    effectAllowed: 'all',
    dropEffect: 'move',
  };
}

function drag(card: HTMLElement, column: HTMLElement) {
  const transfer = dataTransfer();
  for (const [target, type] of [
    [card, 'dragStart'],
    [column, 'dragOver'],
    [column, 'drop'],
    [card, 'dragEnd'],
  ] as const) {
    const event = createEvent[type](target);
    Object.defineProperty(event, 'dataTransfer', { value: transfer });
    fireEvent(target, event);
  }
}

describe('Board view', () => {
  type Handler = (body: unknown) => { status: number; body?: unknown };
  const routes = (put: Handler = (body) => ({ status: 200, body: { ...launch, ...(body as object) } })) => ({
    ...signedIn,
    [ideasRoute]: { status: 200, body: [launch, offsite, readOnly] },
    'PUT /api/v1/ideas/idea-1': put,
  });

  it('shows a column per status with its ideas', async () => {
    fakeApi(routes());
    renderApp('/ideas');

    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));

    const planned = screen.getByRole('region', { name: /Planned/ });
    expect(within(planned).getByRole('link', { name: 'Spring launch' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /In progress/ })).getByRole('link', { name: 'Team offsite' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Postponed/ })).getByText('Drop ideas here')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Done/ })).getByRole('link', { name: 'Leo’s podcast' })).toBeInTheDocument();
  });

  it('moves an idea when it is dropped on another column, keeping its other details', async () => {
    const calls = fakeApi(routes());
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));

    const card = screen.getByRole('link', { name: 'Spring launch' }).closest('li')!;
    const done = screen.getByRole('region', { name: /Done/ });
    drag(card, done);

    expect(within(done).getByRole('link', { name: 'Spring launch' })).toBeInTheDocument();
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
        title: 'Spring launch',
        description: launch.description,
        targetDate: launch.targetDate,
        status: 'Done',
        tags: ['marketing'],
      }),
    );
    expect(await screen.findByText('Moved “Spring launch” to Done')).toBeInTheDocument();
  });

  it('moves an idea from the keyboard with its status menu, and undoes the move', async () => {
    const calls = fakeApi(routes());
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));

    await userEvent.selectOptions(screen.getByLabelText('Status of Spring launch'), 'InProgress');
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(calls.filter((c) => c.method === 'PUT').map((c) => (c.body as { status: string }).status)).toEqual(['InProgress', 'Planned']));
  });

  it('puts an idea back when the move fails', async () => {
    fakeApi(routes(() => ({ status: 403, body: { detail: 'Only the idea’s team can change it.' } })));
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));

    await userEvent.selectOptions(screen.getByLabelText('Status of Spring launch'), 'Done');

    expect(await screen.findByText('Only the idea’s team can change it.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Planned/ })).getByRole('link', { name: 'Spring launch' })).toBeInTheDocument();
  });

  it('does not let people move ideas they cannot edit', async () => {
    fakeApi(routes());
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));

    expect(screen.queryByLabelText('Status of Leo’s podcast')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Leo’s podcast' }).closest('li')).toHaveAttribute('draggable', 'false');
  });

  it('opens an idea from anywhere on its card, with the title as its one link to the idea besides its tags', async () => {
    fakeApi({
      ...routes(),
      'GET /api/v1/ideas/idea-1': { status: 200, body: launch },
      'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
    });
    const router = renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));

    const title = screen.getByRole('link', { name: 'Spring launch' });
    const card = title.closest('li')!;
    // The title link is stretched over the card; it isn't draggable itself, so a drag from anywhere on the card moves the card.
    expect(title).toHaveClass('stretched-link');
    expect(title).toHaveAttribute('draggable', 'false');
    expect(within(card).getAllByRole('link').filter((l) => !l.classList.contains('tag'))).toEqual([title]);

    await userEvent.selectOptions(within(card).getByLabelText('Status of Spring launch'), 'InProgress');
    expect(router.state.location.search).toBe('');

    await userEvent.click(screen.getByRole('link', { name: 'Spring launch' }));
    expect(await screen.findByRole('dialog', { name: 'Spring launch' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?idea=idea-1');
  });

  it('still moves a card dragged by its title', async () => {
    const calls = fakeApi(routes());
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));

    drag(screen.getByRole('link', { name: 'Spring launch' }), screen.getByRole('region', { name: /Done/ }));

    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ status: 'Done' }));
  });
});
