import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { addDays, todayIso } from '../api/dates';
import { anIdea, fakeApi, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

function ideaRoutes(overrides = {}) {
  return {
    ...signedIn,
    'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea(overrides) },
    'GET /api/v1/ideas/idea-1/components': { status: 200, body: [] },
    'GET /api/v1/ideas/idea-1/comments': { status: 200, body: [] },
    'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
    'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
  };
}

describe('Idea start', () => {
  it('plans the start with a date and time, and shows it', async () => {
    const started = anIdea({ startDate: '2099-11-02', startTime: '15:30:00', startsAt: '2099-11-02T15:30:00Z' });
    const calls = fakeApi({ ...ideaRoutes(), 'PUT /api/v1/ideas/idea-1/start': { status: 200, body: started } });
    renderApp('/ideas/idea-1');

    const schedule = within(await screen.findByRole('region', { name: 'Schedule' }));
    await userEvent.click(schedule.getByRole('button', { name: 'Plan the start' }));
    const form = within(schedule.getByRole('form', { name: 'Plan the start' }));
    fireEvent.change(form.getByLabelText('Start date'), { target: { value: '2099-11-02' } });
    fireEvent.change(form.getByLabelText(/Time/), { target: { value: '15:30' } });
    await userEvent.click(form.getByRole('button', { name: 'Save start' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ startDate: '2099-11-02', startTime: '15:30' }));
    expect(await screen.findByText(/^Starts /)).toBeInTheDocument();
  });

  it('shows a planned start and clears it', async () => {
    const calls = fakeApi({
      ...ideaRoutes({ startDate: '2099-11-02', startTime: null, startsAt: '2099-11-02T09:00:00Z' }),
      'PUT /api/v1/ideas/idea-1/start': { status: 200, body: anIdea() },
    });
    renderApp('/ideas/idea-1');

    const schedule = within(await screen.findByRole('region', { name: 'Schedule' }));
    expect(schedule.getByText('Starts')).toBeInTheDocument();
    await userEvent.click(schedule.getByRole('button', { name: 'Clear start' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ startDate: null, startTime: null }));
  });

  it('sends an optional start with a new idea', async () => {
    const calls = fakeApi({
      ...signedIn,
      'GET /api/v1/workspaces/ws-1/ideas': { status: 200, body: [] },
      'POST /api/v1/workspaces/ws-1/ideas': { status: 201, body: anIdea() },
    });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'New idea' }));

    const form = screen.getByRole('form', { name: 'New idea' });
    await userEvent.type(within(form).getByLabelText('Title'), 'Launch');
    const start = addDays(todayIso(), 3);
    fireEvent.change(within(form).getByLabelText(/^Starts/), { target: { value: start } });
    await userEvent.click(within(form).getByRole('button', { name: 'Add idea' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ title: 'Launch', startDate: start, startTime: null }));
  });
});
