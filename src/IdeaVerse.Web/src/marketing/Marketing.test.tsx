import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi, signedIn, signedInAccount, signedOut } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { heroClip } from './HeroClip';
import { walkthroughs } from './walkthroughs';

/** Stubs the "reduce motion" setting, and `play` and `pause`, which jsdom does not implement. */
function motionPreference(reduce: boolean) {
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: media === `(prefers-reduced-motion: ${reduce ? 'reduce' : 'no-preference'})`,
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('pause'));
  });
  return { play, pause };
}

describe('Public pages', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the home page to visitors, with ways to sign up and sign in', async () => {
    fakeApi(signedOut);
    const router = renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: /Turn campaign ideas into action/ })).toBeInTheDocument();
    expect(screen.getByText('Idea planning for marketing teams')).toBeInTheDocument();
    expect(screen.getByText(/Flexible enough for any team’s ideas/)).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('main')).getAllByRole('link', { name: 'Get started free' })[0]!);

    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/register');
  });

  it('shows a muted, looping product clip in the hero, with a poster and a description', async () => {
    fakeApi(signedOut);
    renderApp('/');

    const video = await screen.findByLabelText(heroClip.label);
    expect(video).toHaveAccessibleDescription(heroClip.description);
    expect(video).toHaveAttribute('poster', `${heroClip.src}.webp`);
    expect(video).toHaveAttribute('loop');
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect(video).toHaveAttribute('preload', 'none');
    expect([...video.querySelectorAll('source')].map((source) => source.getAttribute('src'))).toEqual([`${heroClip.src}.mp4`, `${heroClip.src}.webm`]);
  });

  it('plays the hero clip on its own, with a pause button, unless the visitor asked for reduced motion', async () => {
    const { play, pause } = motionPreference(false);
    fakeApi(signedOut);
    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Pause video' }));

    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
  });

  it('shows the hero clip’s poster with a play button when the visitor asked for reduced motion', async () => {
    const { play } = motionPreference(true);
    fakeApi(signedOut);
    renderApp('/');

    const button = await screen.findByRole('button', { name: 'Play video' });
    expect(play).not.toHaveBeenCalled();

    await userEvent.click(button);

    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Pause video' })).toBeInTheDocument();
  });

  it('lists only promises the app keeps under the hero', async () => {
    fakeApi(signedOut);
    renderApp('/');

    const strip = await screen.findByRole('region', { name: 'The small print, up front' });
    expect(within(strip).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Free in early access',
      'No credit card needed',
      'Your data is never sold',
      'Delete your account any time',
    ]);
  });

  it('names prioritising among the home page’s features, and the same steps as How it works', async () => {
    fakeApi(signedOut);
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Decide what’s worth doing' })).toBeInTheDocument();
    expect(screen.getByText(/score impact and effort, and spot the quick wins on the priority matrix/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Four steps from spark to done' })).toBeInTheDocument();
    const steps = within(screen.getByRole('heading', { name: 'Four steps from spark to done' }).closest('section')!).getAllByRole('listitem');
    expect(steps.map((step) => within(step).getByRole('heading').textContent)).toEqual(walkthroughs.map((w) => w.title));
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

  it('presents the email address as the way to reach us when there is no form', async () => {
    fakeApi({ ...signedOut, 'GET /api/v1/contact': { status: 200, body: { available: false, email: 'hello@ideaverse.example' } } });
    renderApp('/contact');

    expect(await screen.findByRole('heading', { name: 'Email us' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'hello@ideaverse.example' })).toHaveAttribute('href', 'mailto:hello@ideaverse.example');
    expect(screen.getByText(/email us and we’ll reply\./)).toBeInTheDocument();
    expect(screen.queryByText(/send us a message/)).not.toBeInTheDocument();
    expect(screen.queryByText(/isn’t available/)).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Contact us' })).not.toBeInTheDocument();
  });

  it('asks visitors to check back when there is neither a form nor an address', async () => {
    fakeApi({ ...signedOut, 'GET /api/v1/contact': { status: 200, body: { available: false, email: null } } });
    renderApp('/contact');

    expect(await screen.findByRole('heading', { name: 'We’ll be here soon' })).toBeInTheDocument();
    expect(screen.queryByText(/send us a message/)).not.toBeInTheDocument();
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
