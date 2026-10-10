import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi, signedOut } from '../test/fakeApi';
import { renderApp } from '../test/render';

describe('Registration and confirmation', () => {
  it('asks the new user to check their inbox instead of signing them in', async () => {
    const calls = fakeApi({ ...signedOut, 'POST /api/v1/auth/register': { status: 200 } });
    renderApp('/register');

    await userEvent.type(await screen.findByLabelText('Email'), 'new@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(screen.getByText('new@example.com')).toBeInTheDocument();
    expect(calls.some((c) => c.path.startsWith('/api/v1/auth/login'))).toBe(false);
  });

  it('explains an unconfirmed sign-in and resends the link', async () => {
    const calls = fakeApi({
      ...signedOut,
      'POST /api/v1/auth/login?useCookies=true': { status: 401, body: { title: 'Unauthorized', detail: 'NotAllowed' } },
      'POST /api/v1/auth/resendConfirmationEmail': { status: 200 },
    });
    renderApp('/login');

    await userEvent.type(await screen.findByLabelText('Email'), 'new@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please confirm your email first');
    await userEvent.click(screen.getByRole('button', { name: 'Send the link again' }));

    expect(await screen.findByText('We sent a new confirmation link to new@example.com.')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/api/v1/auth/resendConfirmationEmail')?.body).toEqual({ email: 'new@example.com' });
  });

  it('confirms the account with the code from the email link', async () => {
    const calls = fakeApi({ ...signedOut, 'GET /api/v1/auth/confirmEmail?userId=u1&code=abc': { status: 200 } });

    renderApp('/confirm-email?userId=u1&code=abc');

    expect(await screen.findByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument();
    expect(calls.filter((c) => c.path.startsWith('/api/v1/auth/confirmEmail'))).toHaveLength(1);
  });

  it('says when a confirmation link no longer works', async () => {
    fakeApi({ ...signedOut, 'GET /api/v1/auth/confirmEmail?userId=u1&code=old': { status: 401 } });

    renderApp('/confirm-email?userId=u1&code=old');

    expect(await screen.findByRole('heading', { name: 'This link didn’t work' })).toBeInTheDocument();
  });
});

describe('Password reset', () => {
  it('links to the reset page from sign-in', async () => {
    fakeApi(signedOut);
    const router = renderApp('/login');

    await userEvent.click(await screen.findByRole('link', { name: 'Forgot your password?' }));

    expect(router.state.location.pathname).toBe('/forgot-password');
  });

  it('sends a reset link without revealing whether the account exists', async () => {
    const calls = fakeApi({ ...signedOut, 'POST /api/v1/auth/forgotPassword': { status: 200 } });
    renderApp('/forgot-password');

    await userEvent.type(await screen.findByLabelText('Email'), 'kat@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText(/If an account uses/)).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ email: 'kat@example.com' });
  });

  it('sets the new password with the code from the link', async () => {
    const calls = fakeApi({ ...signedOut, 'POST /api/v1/auth/resetPassword': { status: 200 } });
    renderApp('/reset-password?email=kat%40example.com&code=c0de');

    await userEvent.type(await screen.findByLabelText('New password'), 'N3w-passw0rd!');
    await userEvent.type(screen.getByLabelText('Repeat new password'), 'N3w-passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('heading', { name: 'Password changed' })).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ email: 'kat@example.com', resetCode: 'c0de', newPassword: 'N3w-passw0rd!' });
  });

  it('catches mismatched passwords before calling the API', async () => {
    const calls = fakeApi(signedOut);
    renderApp('/reset-password?email=kat%40example.com&code=c0de');

    await userEvent.type(await screen.findByLabelText('New password'), 'N3w-passw0rd!');
    await userEvent.type(screen.getByLabelText('Repeat new password'), 'Different1!');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('don’t match');
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(false));
  });

  it('explains an expired reset link', async () => {
    fakeApi({
      ...signedOut,
      'POST /api/v1/auth/resetPassword': { status: 400, body: { errors: { InvalidToken: ['Invalid token.'] } } },
    });
    renderApp('/reset-password?email=kat%40example.com&code=old');

    await userEvent.type(await screen.findByLabelText('New password'), 'N3w-passw0rd!');
    await userEvent.type(screen.getByLabelText('Repeat new password'), 'N3w-passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('expired or was already used');
  });

  it('explains a link missing its code', async () => {
    fakeApi(signedOut);

    renderApp('/reset-password?email=kat%40example.com');

    expect(await screen.findByRole('heading', { name: 'This link is incomplete' })).toBeInTheDocument();
  });
});
