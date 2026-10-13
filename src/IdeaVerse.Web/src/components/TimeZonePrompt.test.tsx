import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { browserTimeZone } from '../api/dates';
import { fakeApi, ideasRoute, signedIn, signedInAccount } from '../test/fakeApi';
import { renderApp } from '../test/render';

/** Signed in with a saved time zone other than this device's (the tests run in UTC). */
function awayFromHome() {
  return {
    ...signedIn,
    'GET /api/v1/account': { status: 200, body: { ...signedInAccount, timeZone: 'Asia/Tokyo' } },
    [ideasRoute]: { status: 200, body: [] },
  };
}

describe('Time zone prompt', () => {
  it('runs in UTC, as the prompt tests expect', () => {
    expect(browserTimeZone()).toBe('UTC');
  });

  it('offers to switch to the device’s time zone, and switches when asked', async () => {
    const calls = fakeApi({
      ...awayFromHome(),
      'PUT /api/v1/account': (body) => ({ status: 200, body: { ...signedInAccount, ...(body as object) } }),
    });
    renderApp('/ideas');

    const prompt = await screen.findByRole('region', { name: 'Time zone' });
    expect(prompt).toHaveTextContent('You seem to be in UTC time, but IdeaVerse is using Tokyo (Asia).');
    await userEvent.click(within(prompt).getByRole('button', { name: 'Switch to UTC' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ timeZone: 'UTC' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Time zone' })).not.toBeInTheDocument());
  });

  it('keeps the saved time zone, and stops asking from this device’s time zone', async () => {
    const calls = fakeApi(awayFromHome());
    renderApp('/ideas');

    await userEvent.click(await screen.findByRole('button', { name: 'Keep Tokyo (Asia)' }));
    expect(screen.queryByRole('region', { name: 'Time zone' })).not.toBeInTheDocument();
    cleanup();

    renderApp('/ideas');
    expect(await screen.findByRole('heading', { name: 'Ideas' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Time zone' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('says nothing when the saved time zone matches the device’s', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/ideas');

    expect(await screen.findByRole('heading', { name: 'Ideas' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Time zone' })).not.toBeInTheDocument();
  });
});
