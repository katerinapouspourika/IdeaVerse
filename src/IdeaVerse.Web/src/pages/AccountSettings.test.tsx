import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { anIdea, fakeApi, ideasRoute, signedIn, signedInAccount } from '../test/fakeApi';
import { renderApp } from '../test/render';

describe('Account settings', () => {
  it('saves a display name and shows it in the header', async () => {
    const calls = fakeApi({
      ...signedIn,
      'PUT /api/v1/account/profile': (body) => ({ status: 200, body: { ...signedInAccount, ...(body as object) } }),
    });
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Profile' });
    await userEvent.type(within(form).getByLabelText('Your name'), 'Katerina');
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('link', { name: 'Katerina' })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/api/v1/account/profile')?.body).toEqual({ displayName: 'Katerina' });
  });

  it('changes the password and shows Identity’s reason when it fails', async () => {
    let attempts = 0;
    const calls = fakeApi({
      ...signedIn,
      'POST /api/v1/auth/manage/info': () =>
        ++attempts === 1 ? { status: 400, body: { errors: { PasswordMismatch: ['Incorrect password.'] } } } : { status: 200, body: {} },
    });
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Password' });
    await userEvent.type(within(form).getByLabelText('Current password'), 'Wrong1!');
    await userEvent.type(within(form).getByLabelText('New password'), 'Newpass1!');
    await userEvent.click(within(form).getByRole('button', { name: 'Change password' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Incorrect password.');

    await userEvent.clear(within(form).getByLabelText('Current password'));
    await userEvent.type(within(form).getByLabelText('Current password'), 'Passw0rd!');
    await userEvent.click(within(form).getByRole('button', { name: 'Change password' }));

    expect(await within(form).findByRole('status')).toHaveTextContent('Password changed.');
    expect(calls.filter((c) => c.method === 'POST').at(-1)?.body).toEqual({ oldPassword: 'Passw0rd!', newPassword: 'Newpass1!' });
  });

  it('sends a confirmation link to a new email address', async () => {
    const calls = fakeApi({ ...signedIn, 'POST /api/v1/auth/manage/info': { status: 200, body: {} } });
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Email' });
    await userEvent.type(within(form).getByLabelText('New email'), 'kat@new.example.com');
    await userEvent.click(within(form).getByRole('button', { name: 'Send confirmation link' }));

    expect(await within(form).findByRole('status')).toHaveTextContent('Check kat@new.example.com for a link');
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ newEmail: 'kat@new.example.com' });
  });

  it('explains why the account can’t be deleted yet', async () => {
    fakeApi({
      ...signedIn,
      'POST /api/v1/account/delete': { status: 409, body: { detail: 'You own Acme Marketing, which other people use. Hand it over first.' } },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Delete account' });
    await userEvent.type(within(form).getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(within(form).getByRole('button', { name: 'Delete my account' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent('You own Acme Marketing');
  });

  it('deletes the account and returns to the sign-in page', async () => {
    const calls = fakeApi({ ...signedIn, 'POST /api/v1/account/delete': { status: 204 } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const router = renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Delete account' });
    await userEvent.type(within(form).getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(within(form).getByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(calls.find((c) => c.path === '/api/v1/account/delete')?.body).toEqual({ password: 'Passw0rd!' });
  });

  it('shows people by name, with their email when they have one', async () => {
    fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [anIdea({ role: 'Viewer', canEdit: false, canManage: false, ownerEmail: 'mia@example.com', ownerName: 'Mia' })] },
    });
    renderApp('/ideas');

    expect(await screen.findByText('By Mia')).toBeInTheDocument();
  });
});
