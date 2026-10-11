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
});
