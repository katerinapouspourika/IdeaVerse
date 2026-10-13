import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { addDays, todayIso } from '../api/dates';
import { anIdea, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

const today = todayIso();
const later = anIdea({ id: 'idea-2', title: 'Team offsite', targetDate: addDays(today, 40), createdAt: `${addDays(today, -3)}T09:00:00Z` });
const soon = anIdea({ id: 'idea-1', title: 'Spring launch', targetDate: addDays(today, 5), createdAt: `${addDays(today, -10)}T09:00:00Z` });
const late = anIdea({ id: 'idea-3', title: 'Old report', targetDate: addDays(today, -2), isOverdue: true, createdAt: `${addDays(today, -90)}T09:00:00Z` });

describe('Timeline view', () => {
  it('lists ideas soonest first, each with its status and date in words', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [later, soon, late] } });
    renderApp('/ideas');

    await userEvent.click(await screen.findByRole('button', { name: 'Timeline' }));

    const rows = within(screen.getByRole('region', { name: 'Timeline' })).getAllByRole('listitem');
    expect(rows.map((r) => within(r).getByRole('link').textContent)).toEqual(['Old report', 'Spring launch', 'Team offsite']);
    expect(within(rows[0]!).getByText(/^Planned · .*\(2 days ago\)$/)).toHaveClass('overdue-text');
    expect(within(rows[1]!).getByText(/^Planned · /)).toBeInTheDocument();
  });

  it('draws bars from when an idea was added to its target date, clipping ones that started before the scale', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [soon, late] } });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Timeline' }));

    const bars = [...document.querySelectorAll<HTMLElement>('.timeline-bar')];

    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveClass('is-overdue', 'clipped');
    expect(bars[1]).toHaveClass('status-planned');
    expect(parseFloat(bars[1]!.style.width)).toBeGreaterThan(0);
  });

  it('opens an idea in the side panel from its row', async () => {
    fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [soon] },
      'GET /api/v1/ideas/idea-1': { status: 200, body: soon },
      'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
    });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Timeline' }));

    const title = screen.getByRole('link', { name: 'Spring launch' });
    // Stretched over its whole row, bar included, so a click anywhere on the row opens the idea.
    expect(title).toHaveClass('stretched-link');
    expect(within(title.closest('li')!).getAllByRole('link')).toEqual([title]);
    await userEvent.click(title);

    expect(await screen.findByRole('dialog', { name: 'Spring launch' })).toBeInTheDocument();
  });
});
