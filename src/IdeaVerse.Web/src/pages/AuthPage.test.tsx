import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { aWorkspace, fakeApi, ideasRoute, signedOut } from '../test/fakeApi';
import { renderApp } from '../test/render';

describe('AuthPage', () => {
  it('redirects a signed-out visitor to the login page', async () => {
    fakeApi(signedOut);

    const router = renderApp('/ideas');

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

  it('signs in with a cookie and opens the dashboard', async () => {
    let signedInNow = false;
    const calls = fakeApi({
      'GET /api/v1/account': () => (signedInNow ? { status: 200, body: { email: 'kat@example.com', timeZone: 'UTC', emailReminders: true, reminderKinds: ['ComingUp', 'Tomorrow', 'Today', 'Overdue'] } } : { status: 401 }),
      'POST /api/v1/auth/login?useCookies=true': () => {
        signedInNow = true;
        return { status: 200 };
      },
      'GET /api/v1/workspaces': { status: 200, body: [aWorkspace()] },
      'GET /api/v1/workspaces/ws-1/assignments': { status: 200, body: [] },
      [ideasRoute]: { status: 200, body: [] },
    });
    const router = renderApp('/login');

    await userEvent.type(await screen.findByLabelText('Email'), 'kat@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ email: 'kat@example.com', password: 'Passw0rd!' });
  });

  it('returns to the page the visitor was going to after signing in', async () => {
    let signedInNow = false;
    fakeApi({
      'GET /api/v1/account': () => (signedInNow ? { status: 200, body: { email: 'kat@example.com', timeZone: 'UTC', emailReminders: true, reminderKinds: ['ComingUp', 'Tomorrow', 'Today', 'Overdue'] } } : { status: 401 }),
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

  it('ticks off the password rules as they are met, and stops a weak password before calling the API', async () => {
    const calls = fakeApi(signedOut);
    renderApp('/register');

    await userEvent.type(await screen.findByLabelText('Email'), 'kat@example.com');
    const password = screen.getByLabelText('Password');
    await userEvent.type(password, 'Password');
    const rules = within(screen.getByRole('list', { name: 'Requirements' }));
    expect(rules.getByText('An uppercase letter')).toHaveTextContent('(done)');
    expect(rules.getByText('A number')).toHaveTextContent('(not yet)');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(password).toHaveAccessibleDescription(expect.stringContaining('Your password doesn’t meet every rule yet.'));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('puts the API’s password rule in plain words under the password', async () => {
    fakeApi({
      ...signedOut,
      'POST /api/v1/auth/register': {
        status: 400,
        body: { title: 'One or more validation errors occurred.', errors: { PasswordRequiresDigit: ['Passwords must have at least one digit (\'0\'-\'9\').'] } },
      },
    });
    renderApp('/register');

    await userEvent.type(await screen.findByLabelText('Email'), 'kat@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(expect.stringContaining('Your password needs a number.')));
    expect(screen.queryByText(/\('0'-'9'\)/)).not.toBeInTheDocument();
  });

  it('offers to sign in or reset the password when the email already has an account', async () => {
    fakeApi({
      ...signedOut,
      'POST /api/v1/auth/register': {
        status: 400,
        body: { errors: { DuplicateUserName: ["Username 'kat@example.com' is already taken."], DuplicateEmail: ["Email 'kat@example.com' is already taken."] } },
      },
    });
    const router = renderApp('/register');

    await userEvent.type(await screen.findByLabelText('Email'), 'kat@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('An account with this email already exists.'));
    expect(screen.queryByText(/already taken/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/forgot-password');
    await userEvent.click(screen.getByRole('link', { name: 'Sign in instead' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByLabelText('Email')).toHaveValue('kat@example.com');
  });

  it('starts the sign-up card empty after typing on the sign-in card', async () => {
    fakeApi({ ...signedOut, 'POST /api/v1/auth/login?useCookies=true': { status: 401, body: { title: 'Unauthorized' } } });
    renderApp('/login');

    await userEvent.type(await screen.findByLabelText('Email'), 'kat@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('link', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('welcomes back on sign-in, with no sign-up button in the header', async () => {
    fakeApi(signedOut);
    renderApp('/login');

    expect(await screen.findByText('Welcome back. Sign in to pick up your ideas where you left them.')).toBeInTheDocument();
    expect(screen.queryByText(/never lose track of a date/)).not.toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', { name: 'Get started free' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('links the Terms and Privacy Policy under Create account, with no sign-up button in the header', async () => {
    fakeApi(signedOut);
    renderApp('/register');

    expect(await screen.findByText(/By creating an account you agree to the/)).toBeInTheDocument();
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(main.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', { name: 'Get started free' })).not.toBeInTheDocument();
  });

  it('keeps the header’s sign-up button on other public pages', async () => {
    fakeApi(signedOut);
    renderApp('/pricing');

    expect(await within(screen.getByRole('navigation', { name: 'Main' })).findByRole('link', { name: 'Get started free' })).toHaveAttribute('href', '/register');
  });
});
