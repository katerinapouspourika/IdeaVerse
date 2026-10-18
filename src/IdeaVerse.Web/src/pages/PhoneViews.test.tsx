import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { addDays, todayIso } from '../api/dates';
import { anIdea, fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { narrowScreen } from '../test/narrowScreen';
import { renderApp } from '../test/render';

const today = todayIso();
const month = today.slice(0, 7);
const launch = anIdea({ id: 'idea-1', title: 'Spring launch', targetDate: `${month}-20`, startDate: `${month}-02` });
const report = anIdea({ id: 'idea-2', title: 'Old report', targetDate: `${month}-05`, isOverdue: true });
const offsite = anIdea({ id: 'idea-3', title: 'Team offsite', targetDate: addDays(`${month}-01`, 40) });

describe('Calendar and Timeline on a phone', () => {
  beforeEach(() => narrowScreen());
  afterEach(() => vi.unstubAllGlobals());

  it('lists the month’s ideas by target date instead of a grid, noting when work starts', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [launch, report, offsite] } });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Calendar' }));

    const calendar = screen.getByRole('region', { name: /\d{4}/ });
    expect(within(calendar).queryByRole('table')).not.toBeInTheDocument();
    expect(within(calendar).getAllByRole('heading', { level: 3 })).toHaveLength(2);
    const [first, second] = within(calendar)
      .getAllByRole('link')
      .map((l) => l.closest('li')!);
    expect(first).toHaveTextContent('Old report');
    expect(first).toHaveTextContent('Overdue');
    expect(second).toHaveTextContent(/Spring launch.*From /);
    expect(within(calendar).queryByRole('link', { name: 'Team offsite' })).not.toBeInTheDocument();

    await userEvent.click(within(calendar).getByRole('button', { name: /Next month/ }));
    expect(within(calendar).getByRole('link', { name: 'Team offsite' })).toHaveAttribute('href', '/ideas/idea-3');
  });

  it('says so when no ideas are due in the month', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [offsite] } });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Calendar' }));

    expect(screen.getByText(/^No ideas due in /)).toBeInTheDocument();
  });

  it('lists the timeline by month, each idea with its dates in words, opening it in the side panel', async () => {
    fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [offsite, launch, report] },
      'GET /api/v1/ideas/idea-1': { status: 200, body: launch },
      'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
    });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'Timeline' }));

    const timeline = screen.getByRole('region', { name: 'Timeline' });
    expect(timeline.querySelector('.timeline-bar')).toBeNull();
    expect(within(timeline).getAllByRole('heading', { level: 3 })).toHaveLength(2);
    const links = within(timeline).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Old report', 'Spring launch', 'Team offsite']);
    expect(links[0]!.closest('li')).toHaveTextContent(/No start date · due /);
    expect(links[1]!.closest('li')).toHaveTextContent(/From .* to .*\(/);

    await userEvent.click(links[1]!);
    expect(await screen.findByRole('dialog', { name: 'Spring launch' })).toBeInTheDocument();
  });
});
