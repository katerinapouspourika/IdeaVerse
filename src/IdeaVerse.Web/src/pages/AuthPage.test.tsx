import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { aWorkspace, fakeApi, ideasRoute, signedOut } from '../test/fakeApi';
import { renderApp } from '../test/render';

describe('AuthPage', () => {
  it('redirects a signed-out visitor to the login page', async () => {
    fakeApi(signedOut);

    const router = renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('shows a friendly message when the password is wrong', async () => {
    fakeApi({ ...signedOut, 'POST /api/v1/auth/login?useCookies=true': { status: 401, body: { title: 'Unauthorized' } } });
    renderApp('/login');

    await userEvent.type(await screen.findByLabelText('Email'), 'kat@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That email and password do not match.');
  });

  it('signs in with a cookie and opens the ideas list', async () => {
    let signedInNow = false;
    const calls = fakeApi({
      'GET /api/v1/account': () => (signedInNow ? { status: 200, body: { email: 'kat@example.com', timeZone: 'UTC' } } : { status: 401 }),
      'POST /api/v1/auth/login?useCookies=true': () => {
        signedInNow = true;
        return { status: 200 };
      },
      'GET /api/v1/workspaces': { status: 200, body: [aWorkspace()] },
      [ideasRoute]: { status: 200, body: [] },
    });
    const router = renderApp('/login');

    await userEvent.type(await screen.findByLabelText('Email'), 'kat@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Ideas' })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ email: 'kat@example.com', password: 'Passw0rd!' });
  });

  it('returns to the page the visitor was going to after signing in', async () => {
    let signedInNow = false;
    fakeApi({
      'GET /api/v1/account': () => (signedInNow ? { status: 200, body: { email: 'kat@example.com', timeZone: 'UTC' } } : { status: 401 }),
      'POST /api/v1/auth/login?useCookies=true': () => {
        signedInNow = true;
        return { status: 200 };
      },
      'GET /api/v1/notifications': { status: 200, body: { items: [], unreadCount: 0 } },
      'GET /api/v1/workspaces': { status: 200, body: [aWorkspace()] },
      'GET /api/v1/invitations': { status: 200, body: [] },
    });
    const router = renderApp('/invitations');

    await userEvent.type(await screen.findByLabelText('Email'), 'kat@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Invitations' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/invitations');
  });

  it('shows the password rules the API rejects on registration', async () => {
    fakeApi({
      ...signedOut,
      'POST /api/v1/auth/register': {
        status: 400,
        body: { title: 'One or more validation errors occurred.', errors: { PasswordRequiresDigit: ['Passwords must have at least one digit.'] } },
      },
    });
    renderApp('/register');

    await userEvent.type(await screen.findByLabelText('Email'), 'kat@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Password!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords must have at least one digit.');
  });

  it('starts the sign-up card empty after typing on the sign-in card', async () => {
    fakeApi({ ...signedOut, 'POST /api/v1/auth/login?useCookies=true': { status: 401, body: { title: 'Unauthorized' } } });
    renderApp('/login');

    await userEvent.type(await screen.findByLabelText('Email'), 'kat@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('link', { name: 'Create an account' }));

    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
