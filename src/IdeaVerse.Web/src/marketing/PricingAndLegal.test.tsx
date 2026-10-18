import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { privacyPolicy, terms } from '../legal/legal';
import { fakeApi, ideasRoute, signedIn, signedOut } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { faq } from './faq';

const robots = () => document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content;

describe('Pricing page', () => {
  it('shows the free early-access plan and answers questions when opened', async () => {
    fakeApi(signedOut);
    const router = renderApp('/pricing');

    expect(await screen.findByRole('heading', { level: 1, name: 'Free while we’re in early access' })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Pricing · IdeaVerse'));
    expect(robots()).toBe('index, follow');
    for (const item of faq) {
      expect(screen.getByText(item.question)).toBeInTheDocument();
    }
    const first = screen.getByText(faq[0]!.question).closest('details')!;
    await userEvent.click(within(first).getByText(faq[0]!.question));
    expect(first).toHaveAttribute('open');
    expect(first.querySelector('summary svg')).toHaveAttribute('aria-hidden', 'true');

    await userEvent.click(within(screen.getByRole('main')).getByRole('link', { name: 'Get started free' }));
    expect(router.state.location.pathname).toBe('/register');
  });

  it('sends someone signed in to their ideas instead', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/pricing');

    expect(await screen.findByRole('link', { name: 'Go to your ideas' })).toHaveAttribute('href', '/ideas');
  });

  it('is linked from the header and the footer', async () => {
    fakeApi(signedOut);
    renderApp('/');

    const main = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(main).getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing');
    const footer = screen.getByRole('navigation', { name: 'Footer' });
    expect(within(footer).getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing');
    expect(within(footer).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(within(footer).getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
  });
});

describe('Footer', () => {
  it('is a slim line with help and the legal pages on signed-in app pages', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/ideas');

    await screen.findByRole('link', { name: 'Help' });
    const footer = screen.getByRole('navigation', { name: 'Footer' });
    expect(within(footer).getAllByRole('link').map((link) => link.textContent)).toEqual(['Help', 'Privacy', 'Terms']);
    expect(within(footer).getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/how-it-works');
    expect(within(footer).queryByRole('link', { name: 'Pricing' })).not.toBeInTheDocument();
  });

  it('keeps the full footer on public pages for someone signed in', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/pricing');

    await screen.findByRole('link', { name: 'Go to your ideas' });
    const footer = screen.getByRole('navigation', { name: 'Footer' });
    expect(within(footer).getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing');
    expect(within(footer).getByRole('link', { name: 'Compare' })).toHaveAttribute('href', '/compare');
  });
});

describe('Legal pages', () => {
  it.each([
    ['/privacy', privacyPolicy],
    ['/terms', terms],
  ])('shows %s as a draft awaiting legal review, kept out of search engines', async (path, document_) => {
    fakeApi(signedOut);
    renderApp(path);

    expect(await screen.findByRole('heading', { level: 1, name: document_.title })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('This is a draft and has not yet been reviewed by a lawyer.');
    const contents = screen.getByRole('navigation', { name: 'Contents' });
    expect(within(contents).getAllByRole('link')).toHaveLength(document_.sections.length);
    for (const section of document_.sections) {
      expect(screen.getByRole('heading', { level: 2, name: section.heading })).toBeInTheDocument();
    }
    await waitFor(() => expect(robots()).toBe('noindex'));
  });
});
