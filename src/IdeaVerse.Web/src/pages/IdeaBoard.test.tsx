import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { statuses } from '../api/types';
import { anIdea, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { longPressMs } from './usePointerDrag';

const launch = anIdea({ id: 'idea-1', title: 'Spring launch', status: 'Planned', tags: ['marketing'] });
const offsite = anIdea({ id: 'idea-2', title: 'Team offsite', status: 'InProgress' });
const readOnly = anIdea({ id: 'idea-3', title: 'Leo’s podcast', status: 'Done', role: 'Viewer', canEdit: false, canManage: false });

/** Lays the columns out side by side, 100 pixels wide and 600 tall, as jsdom has no layout of its own. */
function layOutColumns() {
  for (const [index, status] of statuses.entries()) {
    const column = document.querySelector<HTMLElement>(`[data-drop="${status}"]`)!;
    column.getBoundingClientRect = () => ({ left: index * 100, right: index * 100 + 100, top: 0, bottom: 600, width: 100, height: 600 }) as DOMRect;
  }
}

/** The x coordinate of the middle of a column, as laid out by `layOutColumns`. */
const columnX = (status: string) => statuses.indexOf(status as never) * 100 + 50;

type Pointer = 'mouse' | 'touch' | 'pen';
const pointer = (pointerType: Pointer, clientX: number, clientY = 100) => ({ pointerId: 1, isPrimary: true, button: 0, pointerType, clientX, clientY });

/** Presses on an element and drags to another column's middle with a mouse or pen, then lets go. */
function dragTo(element: HTMLElement, status: string, pointerType: Pointer = 'mouse') {
  fireEvent.pointerDown(element, pointer(pointerType, columnX('Planned')));
  fireEvent.pointerMove(window, pointer(pointerType, columnX('Planned') + 20));
  fireEvent.pointerMove(window, pointer(pointerType, columnX(status)));
  fireEvent.pointerUp(window, pointer(pointerType, columnX(status)));
}

const longPress = () => act(() => new Promise((resolve) => setTimeout(resolve, longPressMs + 50)));

describe('Board view', () => {
  type Handler = (body: unknown) => { status: number; body?: unknown };
  /** The API, which saves a move of the first idea so the refreshed list shows it where it was moved. */
  const routes = (put?: Handler) => {
    let saved = launch;
    return {
      ...signedIn,
      [ideasRoute]: () => ({ status: 200, body: [saved, offsite, readOnly] }),
      'PUT /api/v1/ideas/idea-1':
        put ??
        ((body: unknown) => {
          saved = { ...launch, ...(body as object) };
          return { status: 200, body: saved };
        }),
    };
  };

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

  it('moves an idea dragged to another column with a mouse or pen, showing where it will land', async () => {
    const calls = fakeApi(routes());
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));
    layOutColumns();

    const card = screen.getByRole('link', { name: 'Spring launch' }).closest('li')!;
    const done = screen.getByRole('region', { name: /Done/ });
    fireEvent.pointerDown(card, pointer('pen', columnX('Planned')));
    fireEvent.pointerMove(window, pointer('pen', columnX('Done')));
    expect(card).toHaveClass('dragging');
    expect(done).toHaveClass('drop-target');
    expect(within(done).getByText('Move to Done')).toBeInTheDocument();
    fireEvent.pointerUp(window, pointer('pen', columnX('Done')));

    expect(within(done).getByRole('link', { name: 'Spring launch' })).toBeInTheDocument();
    expect(within(done).queryByText('Move to Done')).not.toBeInTheDocument();
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

  it('picks a card up with a long press on a touch screen, and lets a quick swipe scroll instead', async () => {
    const calls = fakeApi(routes());
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));
    layOutColumns();
    const card = screen.getByRole('link', { name: 'Spring launch' }).closest('li')!;

    // A finger that moves at once is scrolling the board, so the card stays put.
    fireEvent.pointerDown(card, pointer('touch', columnX('Planned')));
    fireEvent.pointerMove(window, pointer('touch', columnX('InProgress')));
    await longPress();
    expect(card).not.toHaveClass('dragging');
    fireEvent.pointerUp(window, pointer('touch', columnX('InProgress')));
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);

    // A finger held still picks the card up, and then carries it.
    fireEvent.pointerDown(card, pointer('touch', columnX('Planned')));
    await longPress();
    expect(card).toHaveClass('dragging');
    fireEvent.pointerMove(window, pointer('touch', columnX('InProgress')));
    fireEvent.pointerUp(window, pointer('touch', columnX('InProgress')));

    expect(within(screen.getByRole('region', { name: /In progress/ })).getByRole('link', { name: 'Spring launch' })).toBeInTheDocument();
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ status: 'InProgress' }));
  });

  it('leaves a card where it was when the drag is cancelled with Escape or dropped outside the columns', async () => {
    const calls = fakeApi(routes());
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));
    layOutColumns();
    const card = screen.getByRole('link', { name: 'Spring launch' }).closest('li')!;

    fireEvent.pointerDown(card, pointer('mouse', columnX('Planned')));
    fireEvent.pointerMove(window, pointer('mouse', columnX('Done')));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(card).not.toHaveClass('dragging');
    fireEvent.pointerUp(window, pointer('mouse', columnX('Done')));

    fireEvent.pointerDown(card, pointer('mouse', columnX('Planned')));
    fireEvent.pointerMove(window, pointer('mouse', 900));
    fireEvent.pointerUp(window, pointer('mouse', 900));

    expect(within(screen.getByRole('region', { name: /Planned/ })).getByRole('link', { name: 'Spring launch' })).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });

  it('moves an idea with the menu on its grip, and undoes the move', async () => {
    const calls = fakeApi(routes());
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));

    await userEvent.click(screen.getByRole('button', { name: 'Move Spring launch' }));
    const menu = screen.getByRole('menu', { name: 'Move to' });
    expect(within(menu).getByRole('menuitemradio', { name: 'Planned' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'In progress' }));

    expect(await within(screen.getByRole('region', { name: /In progress/ })).findByRole('link', { name: 'Spring launch' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(calls.filter((c) => c.method === 'PUT').map((c) => (c.body as { status: string }).status)).toEqual(['InProgress', 'Planned']));
    // Focus goes back with the card, to its grip, rather than being lost with the toast.
    expect(within(screen.getByRole('region', { name: /Planned/ })).getByRole('button', { name: 'Move Spring launch' })).toHaveFocus();
  });

  it('moves an idea from the keyboard with the menu on its grip', async () => {
    const calls = fakeApi(routes());
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));

    screen.getByRole('button', { name: 'Move Spring launch' }).focus();
    await userEvent.keyboard('{Enter}');
    // The menu opens on the idea's column; the next item down is the column after it.
    expect(screen.getByRole('menuitemradio', { name: 'Planned' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    // Focus follows the card to its new column, ready for another move.
    expect(within(screen.getByRole('region', { name: /Postponed/ })).getByRole('button', { name: 'Move Spring launch' })).toHaveFocus();
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ status: 'Postponed' }));
  });

  it('opens the move menu below its grip, or above it when the window has no room below', async () => {
    fakeApi(routes());
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));
    // The menu is 200 pixels tall; the window, 768.
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
    const grip = screen.getByRole('button', { name: 'Move Spring launch' });
    const at = (top: number) => (grip.getBoundingClientRect = () => ({ left: 200, right: 240, top, bottom: top + 40, width: 40, height: 40 }) as DOMRect);

    at(100);
    await userEvent.click(grip);
    expect(screen.getByRole('menu', { name: 'Move to' })).toHaveStyle({ position: 'fixed', top: '146px', bottom: 'auto' });
    await userEvent.keyboard('{Escape}');

    at(600);
    await userEvent.click(grip);
    expect(screen.getByRole('menu', { name: 'Move to' })).toHaveStyle({ position: 'fixed', top: 'auto', bottom: `${window.innerHeight - 600 + 6}px` });
    height.mockRestore();
  });

  it('puts an idea back when the move fails', async () => {
    fakeApi(routes(() => ({ status: 403, body: { detail: 'Only the idea’s team can change it.' } })));
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));

    await userEvent.click(screen.getByRole('button', { name: 'Move Spring launch' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Done' }));

    expect(await screen.findByText('Only the idea’s team can change it.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Planned/ })).getByRole('link', { name: 'Spring launch' })).toBeInTheDocument();
  });

  it('does not let people move ideas they cannot edit', async () => {
    const calls = fakeApi(routes());
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));
    layOutColumns();

    expect(screen.queryByRole('button', { name: 'Move Leo’s podcast' })).not.toBeInTheDocument();
    const card = screen.getByRole('link', { name: 'Leo’s podcast' }).closest('li')!;
    fireEvent.pointerDown(card, pointer('mouse', columnX('Done')));
    fireEvent.pointerMove(window, pointer('mouse', columnX('Planned')));
    fireEvent.pointerUp(window, pointer('mouse', columnX('Planned')));

    expect(within(screen.getByRole('region', { name: /Done/ })).getByRole('link', { name: 'Leo’s podcast' })).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });

  it('opens an idea from anywhere on its card, but not when the card was just dragged by its title', async () => {
    const calls = fakeApi({
      ...routes(),
      'GET /api/v1/ideas/idea-1': { status: 200, body: launch },
      'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
    });
    const router = renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Board' }));
    layOutColumns();

    const title = screen.getByRole('link', { name: 'Spring launch' });
    const card = title.closest('li')!;
    expect(title).toHaveClass('stretched-link');
    expect(within(card).getAllByRole('link').filter((l) => !l.classList.contains('tag'))).toEqual([title]);

    // The click that ends a drag doesn't also open the idea.
    dragTo(title, 'InProgress');
    fireEvent.click(title);
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ status: 'InProgress' }));
    expect(router.state.location.search).toBe('?view=board');

    await userEvent.click(screen.getByRole('link', { name: 'Spring launch' }));
    expect(await screen.findByRole('dialog', { name: 'Spring launch' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?view=board&idea=idea-1');
  });
});
