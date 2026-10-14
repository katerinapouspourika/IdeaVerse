import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi, ideasRoute, signedIn, signedOut } from '../test/fakeApi';
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

  it('says the link signs the new user in and lasts a day, and lets them start again with another email', async () => {
    fakeApi({ ...signedOut, 'POST /api/v1/auth/register': { status: 200 } });
    renderApp('/register');

    await userEvent.type(await screen.findByLabelText('Email'), 'wrong@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/Open it and you’re signed in, ready to go\. The link works for one day\./)).toBeInTheDocument();
    expect(screen.queryByText(/then sign in/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start again' }));

    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('wrong@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('');
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

  it('confirms a new account from the email link and signs it in', async () => {
    let confirmed = false;
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [] },
      'GET /api/v1/account': () => (confirmed ? signedIn['GET /api/v1/account'] : { status: 401 }),
      'POST /api/v1/auth/confirm': () => {
        confirmed = true;
        return { status: 200, body: { signedIn: true } };
      },
    });

    const router = renderApp('/confirm-email?userId=u1&code=abc');

    await waitFor(() => expect(router.state.location.pathname).toBe('/ideas'));
    expect(await screen.findByText('Email confirmed. Welcome to IdeaVerse!')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Ideas' })).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/api/v1/auth/confirm')).toHaveLength(1);
    expect(calls.find((c) => c.path === '/api/v1/auth/confirm')?.body).toEqual({ userId: 'u1', code: 'abc', changedEmail: null });
  });

  it('asks to sign in when the address was already confirmed', async () => {
    fakeApi({ ...signedOut, 'POST /api/v1/auth/confirm': { status: 200, body: { signedIn: false } } });

    renderApp('/confirm-email?userId=u1&code=abc');

    expect(await screen.findByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('says a link without its code is incomplete, without calling the API', async () => {
    const calls = fakeApi(signedOut);

    renderApp('/confirm-email');

    expect(await screen.findByRole('heading', { name: 'This link is incomplete' })).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/api/v1/auth/confirm')).toBe(false);
  });

  it('says when a confirmation link no longer works', async () => {
    fakeApi({ ...signedOut, 'POST /api/v1/auth/confirm': { status: 401 } });

    renderApp('/confirm-email?userId=u1&code=old');

    expect(await screen.findByRole('heading', { name: 'This link didn’t work' })).toBeInTheDocument();
  });
});

describe('Password reset', () => {
  it('links to the reset page from beside the password, carrying over the email typed so far', async () => {
    fakeApi(signedOut);
    const router = renderApp('/login');

    await userEvent.type(await screen.findByLabelText('Email'), 'kat@example.com');
    const password = screen.getByLabelText('Password');
    const forgot = screen.getByRole('link', { name: 'Forgot your password?' });
    expect(password.compareDocumentPosition(forgot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(forgot.compareDocumentPosition(screen.getByRole('button', { name: 'Sign in' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(forgot);

    expect(router.state.location.pathname).toBe('/forgot-password');
    expect(await screen.findByLabelText('Email')).toHaveValue('kat@example.com');
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

    expect(screen.getByLabelText('Repeat new password')).toHaveAccessibleDescription('The two passwords don’t match.');
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
