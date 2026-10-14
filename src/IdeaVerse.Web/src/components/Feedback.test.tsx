import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';

import { FeedbackProvider, useToast } from './Feedback';

/** A page with buttons that raise toasts, inside the provider as the app's layout has it. */
function Page() {
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => toast({ message: 'Saved' })}>
        Save
      </button>
      <button type="button" onClick={() => toast({ message: 'Removed', undo: () => undefined })}>
        Remove
      </button>
      <button type="button" onClick={() => toast({ message: 'Archived' })}>
        Archive
      </button>
    </>
  );
}

function renderToasts() {
  const router = createMemoryRouter(
    [
      {
        element: (
          <FeedbackProvider>
            <Outlet />
          </FeedbackProvider>
        ),
        children: [
          { path: '/a', element: <Page /> },
          { path: '/b', element: <Page /> },
        ],
      },
    ],
    { initialEntries: ['/a'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('Toasts', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows at most two at once, dropping the oldest', async () => {
    renderToasts();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('clears a message about the page left behind, keeping one that can still be undone', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const router = renderToasts();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    now.mockReturnValue(1_002_000);
    await act(() => router.navigate('/b'));

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Removed')).not.toBeInTheDocument();
  });

  it('keeps a message raised just before moving to the next page', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const router = renderToasts();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await act(() => router.navigate('/b'));

    expect(screen.getByText('Saved')).toBeInTheDocument();
  });
});
