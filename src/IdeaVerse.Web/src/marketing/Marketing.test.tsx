import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi, signedIn, signedInAccount, signedOut } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { walkthroughs } from './walkthroughs';

describe('Public pages', () => {
  it('shows the home page to visitors, with ways to sign up and sign in', async () => {
    fakeApi(signedOut);
    const router = renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: /Turn bright ideas into done ideas/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Get started free' }));

    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/register');
  });

  it('shows a video and its steps for every walkthrough', async () => {
    fakeApi(signedOut);
    renderApp('/how-it-works');

    for (const walkthrough of walkthroughs) {
      const video = await screen.findByLabelText(`Video: ${walkthrough.title}`);
      expect(video.querySelector('source')).toHaveAttribute('src', `/how-it-works/${walkthrough.slug}.webm`);
      expect(screen.getByRole('heading', { name: walkthrough.title })).toBeInTheDocument();
    }
  });

  it('opens the menu on small screens and closes it after navigating', async () => {
    fakeApi(signedOut);
    renderApp('/');

    const menu = await screen.findByRole('button', { name: 'Menu' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Contact' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'We’d love to hear from you' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Contact page', () => {
  it('sends a message and thanks the visitor', async () => {
    const calls = fakeApi({ ...signedOut, 'POST /api/v1/contact': { status: 204 } });
    renderApp('/contact');

    const form = await screen.findByRole('form', { name: 'Contact us' });
    await userEvent.type(within(form).getByLabelText('Your name'), 'Mia');
    await userEvent.type(within(form).getByLabelText('Email'), 'mia@example.com');
    await userEvent.type(within(form).getByLabelText('Message'), 'Do you have a team plan?');
    await userEvent.click(within(form).getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('heading', { name: 'Thanks, your message is on its way!' })).toHaveFocus();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Mia', email: 'mia@example.com', message: 'Do you have a team plan?' });
  });

  it('fills in a signed-in user’s name and email', async () => {
    fakeApi({ ...signedIn, 'GET /api/v1/account': { status: 200, body: { ...signedInAccount, displayName: 'Kat' } } });
    renderApp('/contact');

    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveValue('kat@example.com'));
    expect(screen.getByLabelText('Your name')).toHaveValue('Kat');
  });

  it('explains when too many messages were sent', async () => {
    fakeApi({ ...signedOut, 'POST /api/v1/contact': { status: 429 } });
    renderApp('/contact');

    const form = await screen.findByRole('form', { name: 'Contact us' });
    await userEvent.type(within(form).getByLabelText('Your name'), 'Mia');
    await userEvent.type(within(form).getByLabelText('Email'), 'mia@example.com');
    await userEvent.type(within(form).getByLabelText('Message'), 'Hello again');
    await userEvent.click(within(form).getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Please try again in an hour.');
  });
});
