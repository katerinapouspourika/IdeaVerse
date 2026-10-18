import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { anIdea, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { narrowScreen } from '../test/narrowScreen';
import { renderApp } from '../test/render';

const launch = anIdea({ id: 'idea-1', title: 'Spring launch', tags: ['marketing'] });
const routes = {
  ...signedIn,
  [ideasRoute]: { status: 200, body: [launch] },
  [`${ideasRoute}?status=Done`]: { status: 200, body: [] },
  [`${ideasRoute}?status=Done&tag=marketing`]: { status: 200, body: [] },
  'GET /api/v1/workspaces/ws-1/tags': { status: 200, body: ['marketing'] },
};

describe('Ideas filters on a phone', () => {
  beforeEach(() => narrowScreen());
  afterEach(() => vi.unstubAllGlobals());

  it('shows a search box and a Filters button, with status, tag, and order behind it', async () => {
    fakeApi(routes);
    renderApp('/ideas');
    await screen.findByText('Spring launch');

    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Filter by status' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Sort by')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Filters' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const panel = screen.getByRole('region', { name: 'Filters' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Close filters' }));
    expect(screen.queryByRole('region', { name: 'Filters' })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it('counts the active filters on the button', async () => {
    fakeApi(routes);
    renderApp('/ideas');
    await screen.findByText('Spring launch');
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));

    const panel = screen.getByRole('region', { name: 'Filters' });
    await userEvent.click(within(within(panel).getByRole('navigation', { name: 'Filter by status' })).getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Filters, 1 active' })).toBeInTheDocument();
    await userEvent.selectOptions(within(panel).getByLabelText('Tag'), 'marketing');
    expect(screen.getByRole('button', { name: 'Filters, 2 active' })).toBeInTheDocument();
    expect(within(panel).getByLabelText('Sort by')).toBeInTheDocument();

    // Escape closes the panel and returns to its button.
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Filters' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters, 2 active' })).toHaveFocus();
  });

  it('shows the views as named icon buttons', async () => {
    fakeApi(routes);
    renderApp('/ideas');
    await screen.findByText('Spring launch');

    const views = within(screen.getByRole('group', { name: 'View' })).getAllByRole('button');
    expect(views.map((b) => b.getAttribute('aria-label'))).toEqual(['List', 'Board', 'Calendar', 'Timeline', 'Matrix']);
    expect(views.every((b) => b.textContent === '')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(screen.getByRole('button', { name: 'Timeline' })).toHaveAttribute('aria-pressed', 'true');
  });
});
