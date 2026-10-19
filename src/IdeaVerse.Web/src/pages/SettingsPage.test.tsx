import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { browserTimeZone } from '../api/dates';
import { fakeApi, ideasRoute, signedIn, signedInAccount } from '../test/fakeApi';
import { renderApp } from '../test/render';

describe('SettingsPage', () => {
  it('opens from the account menu and saves a new time zone', async () => {
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [] },
      'PUT /api/v1/account': (body) => ({ status: 200, body: { ...signedInAccount, ...(body as object) } }),
    });
    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Account: kat@example.com' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));
    const form = await screen.findByRole('form', { name: 'Time zone' });
    const select = within(form).getByLabelText('Your time zone');
    expect(select).toHaveValue('UTC');

    await userEvent.selectOptions(select, 'Europe/Athens');

    expect(await within(form).findByText('Saved')).toBeInTheDocument();
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

    expect(await within(form).findByText('Choose a time zone from the list, such as Europe/Athens.')).toBeInTheDocument();
    expect(within(form).getByLabelText('Your time zone')).toHaveValue('UTC');
    expect(within(form).queryByText('Saved')).not.toBeInTheDocument();
  });

  it('labels time zones with their UTC offset, under their current names', async () => {
    fakeApi(signedIn);
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Time zone' });
    const select = within(form).getByRole('combobox', { name: 'Your time zone' });

    expect(within(select).getByRole('option', { name: '(UTC+00:00) UTC' })).toHaveValue('UTC');
    expect(within(select).getByRole('option', { name: /^\(UTC\+0[23]:00\) Athens \(Europe\)$/ })).toHaveValue('Europe/Athens');
    expect(within(select).getByRole('option', { name: '(UTC+05:30) Kolkata (Asia)' })).toHaveValue('Asia/Kolkata');
    expect(within(select).queryByRole('option', { name: /Calcutta/ })).not.toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: /Asmera/ })).not.toBeInTheDocument();
  });

  it('finds a time zone by searching, and saves its IANA id', async () => {
    const calls = fakeApi({
      ...signedIn,
      'PUT /api/v1/account': (body) => ({ status: 200, body: { ...signedInAccount, ...(body as object) } }),
    });
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Time zone' });
    await userEvent.type(within(form).getByRole('searchbox', { name: 'Search time zones' }), 'kolkata');

    expect(within(form).getByText('1 time zone matches.')).toBeInTheDocument();
    expect(within(form).getByRole('combobox', { name: 'Your time zone' })).toHaveValue('Asia/Kolkata');

    // Saved once typing pauses, and only the last match.
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ timeZone: 'Asia/Kolkata' }), { timeout: 3000 });
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  });

  it('finds UTC by name, and other zones by their offset from it', async () => {
    fakeApi({ ...signedIn, 'GET /api/v1/account': { status: 200, body: { ...signedInAccount, timeZone: 'Asia/Kolkata' } } });
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Time zone' });
    const search = within(form).getByRole('searchbox', { name: 'Search time zones' });
    await userEvent.type(search, 'utc');

    expect(within(form).getByText('1 time zone matches.')).toBeInTheDocument();
    expect(within(form).getByRole('combobox', { name: 'Your time zone' })).toHaveValue('UTC');

    await userEvent.clear(search);
    await userEvent.type(search, 'UTC+05:30 kolkata');
    expect(within(form).getByRole('combobox', { name: 'Your time zone' })).toHaveValue('Asia/Kolkata');
  });

  it('says when no time zone matches, and keeps the choice', async () => {
    fakeApi(signedIn);
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Time zone' });
    await userEvent.click(within(form).getByRole('searchbox', { name: 'Search time zones' }));
    await userEvent.paste('Atlantis');

    expect(within(form).getByText('No time zone matches “Atlantis”.')).toBeInTheDocument();
    expect(within(form).getByRole('combobox', { name: 'Your time zone' })).toHaveValue('UTC');
    expect(within(form).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
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

    expect(await within(form).findByText('Saved')).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(3));
    expect(calls.filter((c) => c.method === 'PUT').map((c) => c.body)).toEqual([
      { emailReminders: true, reminderKinds: ['Tomorrow', 'Today', 'Overdue'], emailComments: false, emailFrequency: 'RightAway' },
      { emailReminders: true, reminderKinds: ['Today', 'Overdue'], emailComments: false, emailFrequency: 'RightAway' },
      { emailReminders: false, reminderKinds: ['Today', 'Overdue'], emailComments: false, emailFrequency: 'RightAway' },
    ]);
  });

  it('turns comment emails on, only while reminders are emailed', async () => {
    const calls = fakeApi({
      ...signedIn,
      'PUT /api/v1/account/reminders': (body) => ({ status: 200, body: { ...signedInAccount, ...(body as object) } }),
    });
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Reminders' });
    const comments = within(form).getByRole('checkbox', { name: /Email me about new comments too/ });
    expect(comments).not.toBeChecked();
    await userEvent.click(comments);

    expect(await within(form).findByText('Saved')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ emailReminders: true, emailComments: true });

    await userEvent.click(within(form).getByRole('checkbox', { name: 'Also email me these reminders' }));
    expect(comments).toBeDisabled();
    expect(comments).not.toBeChecked();
  });

  it('switches emails to a daily digest straight away, only while reminders are emailed', async () => {
    const calls = fakeApi({
      ...signedIn,
      'PUT /api/v1/account/reminders': (body) => ({ status: 200, body: { ...signedInAccount, ...(body as object) } }),
    });
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Reminders' });
    const group = within(form).getByRole('group', { name: 'When to email me' });
    expect(within(group).getByRole('radio', { name: /Send right away/ })).toBeChecked();
    const digest = within(group).getByRole('radio', { name: /Daily digest/ });
    expect(digest).toHaveAccessibleName(expect.stringContaining('Mentions are always sent right away'));
    await userEvent.click(digest);

    expect(await within(form).findByText('Saved')).toBeInTheDocument();
    expect(digest).toBeChecked();
    expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ emailReminders: true, emailFrequency: 'DailyDigest' });

    await userEvent.click(within(form).getByRole('checkbox', { name: 'Also email me these reminders' }));
    expect(digest).toBeDisabled();
  });

  it('warns before turning every reminder off', async () => {
    fakeApi({
      ...signedIn,
      'PUT /api/v1/account/reminders': (body) => ({ status: 200, body: { ...signedInAccount, ...(body as object) } }),
    });
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Reminders' });
    for (const name of [/Coming up/, /Due tomorrow/, /Due today/, /Overdue/]) {
      await userEvent.click(within(form).getByRole('checkbox', { name }));
    }

    expect(within(form).getByRole('note')).toHaveTextContent('you won’t get any reminders');
  });

  it('puts a switch back and says why when it can’t be saved', async () => {
    fakeApi({ ...signedIn, 'PUT /api/v1/account/reminders': { status: 500, body: { detail: 'Something went wrong on our side.' } } });
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Reminders' });
    const overdue = within(form).getByRole('checkbox', { name: /Overdue/ });
    await userEvent.click(overdue);

    expect(await within(form).findByText('Something went wrong on our side.')).toBeInTheDocument();
    expect(overdue).toBeChecked();
    expect(within(form).queryByText('Saved')).not.toBeInTheDocument();
  });

  it('lists its sections and jumps to each', async () => {
    fakeApi(signedIn);
    const router = renderApp('/settings');

    const menu = within(await screen.findByRole('navigation', { name: 'Settings sections' }));
    expect(menu.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Profile',
      'Email',
      'Password',
      'Time zone',
      'Reminders',
      'Delete account',
    ]);
    await userEvent.click(menu.getByRole('link', { name: 'Reminders' }));

    expect(router.state.location.hash).toBe('#reminders');
    expect(screen.getByRole('form', { name: 'Reminders' })).toHaveAttribute('id', 'reminders');
    expect(screen.getByRole('form', { name: 'Time zone' })).toHaveAttribute('id', 'time-zone');
  });
});
