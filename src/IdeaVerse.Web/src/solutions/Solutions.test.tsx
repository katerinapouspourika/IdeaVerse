import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi, ideasRoute, signedIn, signedOut } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { comparisons, useCases } from './content';

describe('Use case pages', () => {
  it('lists every use case and opens one with its problems, features, and templates', async () => {
    fakeApi(signedOut);
    const router = renderApp('/use-cases');

    expect(await screen.findByRole('heading', { level: 1, name: 'Made for teams with more ideas than time' })).toBeInTheDocument();
    for (const u of useCases) {
      expect(screen.getByRole('link', { name: new RegExp(u.audience) })).toHaveAttribute('href', `/use-cases/${u.slug}`);
    }
    await userEvent.click(screen.getByRole('link', { name: /Marketing teams/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/use-cases/marketing-teams'));
    const marketing = useCases.find((u) => u.slug === 'marketing-teams')!;
    expect(await screen.findByRole('heading', { level: 1, name: marketing.headline })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('IdeaVerse for marketing teams · IdeaVerse'));
    for (const h of marketing.helps) {
      expect(screen.getByRole('heading', { level: 3, name: h.title })).toBeInTheDocument();
    }
    const templates = screen.getByRole('region', { name: 'Templates to start with' });
    expect(within(templates).getByRole('link', { name: /Marketing campaign/ })).toHaveAttribute('href', '/templates/marketing-campaign');
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Get started free' })).toHaveAttribute('href', '/register');
  });

  it('offers signed-in people their ideas instead of sign-up', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/use-cases/small-businesses');

    expect(await screen.findByRole('link', { name: 'Go to your ideas' })).toHaveAttribute('href', '/ideas');
  });
});

describe('Comparison pages', () => {
  it('lists every comparison and shows one as a table, with when the alternative is better', async () => {
    fakeApi(signedOut);
    renderApp('/compare');

    for (const c of comparisons) {
      expect(await screen.findByRole('link', { name: new RegExp(`IdeaVerse vs ${c.alternative}`) })).toHaveAttribute('href', `/compare/${c.slug}`);
    }
    await userEvent.click(screen.getByRole('link', { name: /IdeaVerse vs a spreadsheet/ }));

    const sheet = comparisons.find((c) => c.slug === 'spreadsheets')!;
    const table = await screen.findByRole('table', { name: 'IdeaVerse compared with a spreadsheet' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Topic', 'Spreadsheet', 'IdeaVerse']);
    expect(within(table).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(sheet.rows.map((r) => r.topic));
    const fair = screen.getByRole('region', { name: 'When a spreadsheet is the better choice' });
    expect(within(fair).getAllByRole('listitem')).toHaveLength(sheet.goodFor.length);
  });

  it('shows the not found page for an unknown comparison', async () => {
    fakeApi(signedOut);
    renderApp('/compare/nothing');

    expect(await screen.findByRole('heading', { name: /not found|doesn’t exist/i })).toBeInTheDocument();
  });
});
