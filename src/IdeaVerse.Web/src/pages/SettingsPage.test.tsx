import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { browserTimeZone } from '../api/dates';
import { fakeApi, ideasRoute, signedIn, signedInAccount } from '../test/fakeApi';
import { renderApp } from '../test/render';

describe('SettingsPage', () => {
  it('opens from the email in the header and saves a new time zone', async () => {
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [] },
      'PUT /api/v1/account': (body) => ({ status: 200, body: { ...signedInAccount, ...(body as object) } }),
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
      'GET /api/v1/account': { status: 200, body: { ...signedInAccount, timeZone: null } },
      'PUT /api/v1/account': (body) => ({ status: 200, body: { ...signedInAccount, ...(body as object) } }),
      [ideasRoute]: { status: 200, body: [] },
    });

    renderApp('/');

    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ timeZone: browserTimeZone() }));
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  });

  it('saves which reminders to get and turns emails off', async () => {
    const calls = fakeApi({
      ...signedIn,
      'PUT /api/v1/account/reminders': (body) => ({ status: 200, body: { ...signedInAccount, ...(body as object) } }),
    });
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Reminders' });
    await userEvent.click(within(form).getByRole('checkbox', { name: /Coming up/ }));
    await userEvent.click(within(form).getByRole('checkbox', { name: /Due tomorrow/ }));
    await userEvent.click(within(form).getByRole('checkbox', { name: 'Also email me these reminders' }));
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));

    expect(await within(form).findByRole('status')).toHaveTextContent('Saved.');
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ emailReminders: false, reminderKinds: ['Today', 'Overdue'] });
  });

  it('warns before turning every reminder off', async () => {
    fakeApi(signedIn);
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Reminders' });
    for (const name of [/Coming up/, /Due tomorrow/, /Due today/, /Overdue/]) {
      await userEvent.click(within(form).getByRole('checkbox', { name }));
    }

    expect(within(form).getByRole('note')).toHaveTextContent('you won’t get any reminders');
  });
});
