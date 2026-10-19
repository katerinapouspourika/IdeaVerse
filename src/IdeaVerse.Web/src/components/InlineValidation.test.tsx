import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { aWorkspace, fakeApi, ideasRoute, signedIn, signedOut } from '../test/fakeApi';
import { renderApp } from '../test/render';

describe('Inline validation', () => {
  it('explains empty sign-in fields in the form instead of the browser’s bubbles, focusing the first', async () => {
    const calls = fakeApi(signedOut);
    renderApp('/login');

    const email = await screen.findByLabelText('Email');
    const form = email.closest('form');
    expect(form).toHaveAttribute('novalidate');
    expect(email).toBeRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(email).toHaveAccessibleDescription('Enter your email address.');
    expect(email).toBeInvalid();
    expect(email).toHaveFocus();
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('checks a field again as it changes after the first submit', async () => {
    fakeApi(signedOut);
    renderApp('/register');

    const email = await screen.findByLabelText('Email');
    await userEvent.type(email, 'not-an-email');
    await userEvent.tab();
    expect(email).not.toHaveAccessibleDescription(expect.stringContaining('valid email'));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(email).toHaveAccessibleDescription('Enter a valid email address, like name@company.com.');
    await userEvent.clear(email);
    expect(email).toHaveAccessibleDescription('Enter your email address.');
    await userEvent.type(email, 'kat@example.com');

    expect(email).not.toHaveAccessibleDescription(expect.stringContaining('valid email'));
  });

  it('asks for an email before sending a reset link', async () => {
    const calls = fakeApi(signedOut);
    renderApp('/forgot-password');

    await userEvent.click(await screen.findByRole('button', { name: 'Send reset link' }));

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email address.');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('asks for the new password twice before resetting it', async () => {
    const calls = fakeApi(signedOut);
    renderApp('/reset-password?email=kat%40example.com&code=c0de');

    await userEvent.click(await screen.findByRole('button', { name: 'Change password' }));

    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(expect.stringContaining('Choose a new password.'));
    expect(screen.getByLabelText('New password')).toHaveFocus();
    expect(screen.getByLabelText('Repeat new password')).toHaveAccessibleDescription('Repeat your new password.');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('asks for a workspace name', async () => {
    const calls = fakeApi({ ...signedIn, 'GET /api/v1/workspaces': { status: 200, body: [] }, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/ideas');

    const form = await screen.findByRole('form', { name: 'Create workspace' });
    await userEvent.type(within(form).getByLabelText('Workspace name'), '   ');
    await userEvent.click(within(form).getByRole('button', { name: 'Create workspace' }));

    expect(within(form).getByLabelText('Workspace name')).toHaveAccessibleDescription('Give your workspace a name.');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('asks for the address to invite', async () => {
    const calls = fakeApi({
      ...signedIn,
      'GET /api/v1/workspaces': { status: 200, body: [aWorkspace({ role: 'Owner' })] },
      'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] },
      'GET /api/v1/workspaces/ws-1/invitations': { status: 200, body: [] },
      [ideasRoute]: { status: 200, body: [] },
    });
    renderApp('/people');

    const form = await screen.findByRole('form', { name: 'Invite people' });
    expect(form).toHaveAttribute('novalidate');
    await userEvent.click(within(form).getByRole('button', { name: 'Send invitation' }));

    expect(within(form).getByLabelText('Email addresses')).toHaveAccessibleDescription(expect.stringContaining('Enter the email addresses to invite.'));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('asks for the password before deleting the account, without asking to confirm', async () => {
    const calls = fakeApi(signedIn);
    renderApp('/settings');

    const form = await screen.findByRole('form', { name: 'Delete account' });
    await userEvent.click(within(form).getByRole('button', { name: 'Delete my account' }));

    expect(within(form).getByLabelText('Password')).toHaveAccessibleDescription('Enter your password to confirm.');
    expect(within(form).getByLabelText('Password')).toHaveFocus();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('asks for a new idea’s title', async () => {
    const calls = fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/ideas');
    await userEvent.click(await screen.findByRole('button', { name: 'New idea' }));

    const form = screen.getByRole('form', { name: 'New idea' });
    await userEvent.click(within(form).getByRole('button', { name: 'Add idea' }));

    const title = within(form).getByLabelText('Title');
    expect(title).toHaveAccessibleDescription('Give your idea a title.');
    await waitFor(() => expect(title).toHaveFocus());
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});
