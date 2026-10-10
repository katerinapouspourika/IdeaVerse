import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { browserTimeZone } from '../api/dates';
import { fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

describe('SettingsPage', () => {
  it('opens from the email in the header and saves a new time zone', async () => {
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [] },
      'PUT /api/v1/account': (body) => ({ status: 200, body: { email: 'kat@example.com', ...(body as object) } }),
    });
    renderApp('/');

    await userEvent.click(await screen.findByRole('link', { name: 'kat@example.com' }));
    const form = await screen.findByRole('form', { name: 'Time zone' });
    const select = within(form).getByLabelText('Your time zone');
    expect(select).toHaveValue('UTC');

    await userEvent.selectOptions(select, 'Europe/Athens');
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));

    expect(await within(form).findByRole('status')).toHaveTextContent('Saved.');
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ timeZone: 'Europe/Athens' });
  });

  it('shows the API message for a time zone it rejects', async () => {
    fakeApi({
      ...signedIn,
      'PUT /api/v1/account': { status: 400, body: { errors: { timeZone: ['Choose a time zone from the list, such as Europe/Athens.'] } } },
    });
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Time zone' });
    await userEvent.selectOptions(within(form).getByLabelText('Your time zone'), 'Asia/Tokyo');
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));

    expect(await within(form).findByText('Choose a time zone from the list, such as Europe/Athens.')).toBeInTheDocument();
  });

  it('sets the browser’s time zone on an account that has none yet', async () => {
    const calls = fakeApi({
      ...signedIn,
      'GET /api/v1/account': { status: 200, body: { email: 'kat@example.com', timeZone: null } },
      'PUT /api/v1/account': (body) => ({ status: 200, body: { email: 'kat@example.com', ...(body as object) } }),
      [ideasRoute]: { status: 200, body: [] },
    });

    renderApp('/');

    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ timeZone: browserTimeZone() }));
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  });
});
