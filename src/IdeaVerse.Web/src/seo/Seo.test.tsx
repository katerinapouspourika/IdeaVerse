import { screen, waitFor } from '@testing-library/react';

import { fakeApi, ideasRoute, signedIn, signedOut } from '../test/fakeApi';
import { renderApp } from '../test/render';

const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute('content');
const description = () => document.head.querySelector('meta[name="description"]')?.getAttribute('content');

describe('Page titles and search engine tags', () => {
  it('gives each public page its own title and description, open to search engines', async () => {
    fakeApi(signedOut);
    renderApp('/how-it-works');

    await waitFor(() => expect(document.title).toBe('How it works · IdeaVerse'));
    expect(description()).toMatch(/^Watch short walkthroughs/);
    expect(robots()).toBe('index, follow');
  });

  it('keeps signed-in pages out of search engines', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/ideas');

    await waitFor(() => expect(document.title).toBe('Ideas · IdeaVerse'));
    expect(robots()).toBe('noindex');
  });

  it('shows a not found page for unknown addresses', async () => {
    fakeApi(signedOut);
    renderApp('/no-such-page');

    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
    await waitFor(() => expect(robots()).toBe('noindex'));
  });
});

describe('Remembered sign-in', () => {
  it('remembers a signed-in visit for the next page load', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/ideas');

    await waitFor(() => expect(localStorage.getItem('ideaverse.session')).toBe('1'));
  });

  it('forgets it once the session has ended, showing the public home page', async () => {
    localStorage.setItem('ideaverse.session', '1');
    fakeApi(signedOut);
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: /Turn bright ideas/ })).toBeInTheDocument();
    expect(localStorage.getItem('ideaverse.session')).toBeNull();
  });
});
