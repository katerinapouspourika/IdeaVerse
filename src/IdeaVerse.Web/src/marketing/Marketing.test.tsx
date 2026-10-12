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
      expect(video.querySelector('source')).toHaveAttribute('src', `/how-it-works/${walkthrough.slug}.mp4`);
      expect(screen.getByRole('heading', { name: walkthrough.title })).toBeInTheDocument();
    }
  });

  it('plays a walkthrough from the button in its middle, showing the controls once it has started', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
    fakeApi(signedOut);
    renderApp('/how-it-works');
    const [first] = walkthroughs;
    const video = await screen.findByLabelText(`Video: ${first!.title}`);
    expect(video).not.toHaveAttribute('controls');

    await userEvent.click(screen.getByRole('button', { name: `Play video: ${first!.title}` }));

    expect(play).toHaveBeenCalled();
    expect(video).toHaveAttribute('controls');
    expect(screen.queryByRole('button', { name: `Play video: ${first!.title}` })).not.toBeInTheDocument();
    play.mockRestore();
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

  it('opens Explore in the header, closes it with Escape, and goes to a page from it', async () => {
    fakeApi(signedOut);
    const router = renderApp('/');
    const nav = within(await screen.findByRole('navigation', { name: 'Main' }));

    const explore = nav.getByRole('button', { name: 'Explore' });
    await userEvent.click(explore);
    expect(explore).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(explore).toHaveAttribute('aria-expanded', 'false');
    expect(explore).toHaveFocus();

    await userEvent.click(explore);
    await userEvent.click(nav.getByRole('link', { name: /Use cases/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Made for teams with more ideas than time' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/use-cases');
    expect(nav.getByRole('button', { name: 'Explore' })).toHaveAttribute('aria-expanded', 'false');
    expect(nav.getByRole('button', { name: 'Explore' })).toHaveClass('active');
  });
});

describe('Public page layout', () => {
  it.each(['/pricing', '/templates', '/templates/product-launch', '/use-cases/marketing-teams', '/compare', '/privacy'])(
    'runs %s edge to edge, like the home page',
    async (path) => {
      fakeApi(signedOut);
      renderApp(path);

      await screen.findByRole('heading', { level: 1 });
      expect(screen.getByRole('main')).toHaveClass('full');
    },
  );

  it('keeps signed-in pages in the content column', async () => {
    fakeApi({ ...signedIn, 'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [] } });
    renderApp('/settings');

    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    expect(screen.getByRole('main')).not.toHaveClass('full');
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

describe('Contact page when sending is not possible', () => {
  const available = { 'GET /api/v1/contact': { status: 200, body: { available: true, email: 'hello@ideaverse.example' } } };

  async function writeAndSend() {
    const form = await screen.findByRole('form', { name: 'Contact us' });
    await userEvent.type(within(form).getByLabelText('Your name'), 'Mia');
    await userEvent.type(within(form).getByLabelText('Email'), 'mia@example.com');
    await userEvent.type(within(form).getByLabelText('Message'), 'Do you have a team plan?');
    await userEvent.click(within(form).getByRole('button', { name: 'Send message' }));
  }

  it('offers the email address beside the form', async () => {
    fakeApi({ ...signedOut, ...available });
    renderApp('/contact');

    expect(await screen.findByRole('link', { name: 'hello@ideaverse.example' })).toHaveAttribute('href', 'mailto:hello@ideaverse.example');
    expect(screen.getByRole('form', { name: 'Contact us' })).toBeInTheDocument();
  });

  it('says so before anyone writes, and gives the email address instead', async () => {
    fakeApi({ ...signedOut, 'GET /api/v1/contact': { status: 200, body: { available: false, email: 'hello@ideaverse.example' } } });
    renderApp('/contact');

    expect(await screen.findByRole('heading', { name: 'Our contact form isn’t available right now' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'hello@ideaverse.example' })).toHaveAttribute('href', 'mailto:hello@ideaverse.example');
    expect(screen.queryByRole('form', { name: 'Contact us' })).not.toBeInTheDocument();
  });

  it('keeps a message that failed to send, ready to email or copy', async () => {
    fakeApi({ ...signedOut, ...available, 'POST /api/v1/contact': { status: 500 } });
    renderApp('/contact');

    await writeAndSend();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your message wasn’t sent, but it’s still here.');
    expect(within(alert).getByRole('link', { name: 'Email it instead' })).toHaveAttribute(
      'href',
      'mailto:hello@ideaverse.example?subject=Message%20from%20Mia&body=Do%20you%20have%20a%20team%20plan%3F',
    );
    expect(screen.getByLabelText('Message')).toHaveValue('Do you have a team plan?');
  });
});
