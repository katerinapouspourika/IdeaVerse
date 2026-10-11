import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

describe('When the API cannot be reached', () => {
  it('says so instead of signing the user out, and recovers on Try again', async () => {
    let online = false;
    fakeApi({
      ...signedIn,
      'GET /api/v1/account': () => {
        if (!online) {
          throw new TypeError('Failed to fetch');
        }
        return signedIn['GET /api/v1/account'];
      },
      [ideasRoute]: { status: 200, body: [] },
    });
    const router = renderApp('/ideas');

    expect(await screen.findByRole('heading', { name: 'Can’t reach IdeaVerse' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ideas');

    online = true;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ideas' })).toBeInTheDocument());
  });

  it('still sends someone who is signed out to the sign-in page', async () => {
    fakeApi({ 'GET /api/v1/account': { status: 401 } });
    const router = renderApp('/ideas');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});
