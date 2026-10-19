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

  it('draws bars from an idea\'s start date to its target date, clipping ones that started before the scale', async () => {
    const started = { ...soon, startDate: addDays(today, -2) };
    const longAgo = { ...late, startDate: addDays(today, -90) };
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [started, longAgo] } });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Timeline' }));

    const bars = [...document.querySelectorAll<HTMLElement>('.timeline-bar')];

    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveClass('is-overdue', 'clipped');
    expect(bars[1]).toHaveClass('status-planned');
    expect(bars[1]).not.toHaveClass('timeline-marker');
    expect(parseFloat(bars[1]!.style.width)).toBeGreaterThan(0);
    expect(parseFloat(bars[1]!.style.left)).toBeLessThan(parseFloat(document.querySelector<HTMLElement>('.timeline-today')!.style.left));
    expect(screen.getByText(/^Planned · starts .* · due .*\(in 5 days\)$/)).toBeInTheDocument();
  });

  it('tags ideas due before the scale as earlier, rather than drawing them in its first month', async () => {
    const done = anIdea({ id: 'idea-4', title: 'Last year’s survey', status: 'Done', startDate: addDays(today, -120), targetDate: addDays(today, -100) });
    const undated = anIdea({ id: 'idea-5', title: 'Old plan', status: 'Postponed', targetDate: addDays(today, -100) });
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [done, undated, soon] } });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Timeline' }));

    const rows = within(screen.getByRole('region', { name: 'Timeline' })).getAllByRole('listitem');
    for (const [row, status] of [
      [rows[0]!, 'status-done'],
      [rows[1]!, 'status-postponed'],
    ] as const) {
      expect(row.querySelector('.timeline-bar')).toBeNull();
      expect(within(row).getByText('Earlier')).toHaveClass('timeline-earlier', status);
    }
    expect(within(rows[2]!).queryByText('Earlier')).not.toBeInTheDocument();
    expect(rows[2]!.querySelector('.timeline-bar')).toBeInTheDocument();
  });

  it('marks an idea with no start date by a dot on its target date, and says so', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [soon] } });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Timeline' }));

    const marker = document.querySelector<HTMLElement>('.timeline-bar')!;
    expect(marker).toHaveClass('timeline-marker', 'status-planned');
    expect(marker.style.width).toBe('');
    // Added ten days ago, but drawn from nowhere but its target date, after today.
    expect(parseFloat(marker.style.left)).toBeGreaterThan(parseFloat(document.querySelector<HTMLElement>('.timeline-today')!.style.left));
    expect(screen.getByText(/^Planned · no start date · due .*\(in 5 days\)$/)).toBeInTheDocument();
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
