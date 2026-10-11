import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { fakeApi, ideasRoute, signedIn } from '../test/fakeApi';
import { renderApp } from '../test/render';

/** A stand-in for the browser's install offer. */
function offerInstall() {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn(() => Promise.resolve());
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
}

describe('Installing the app', () => {
  it('offers Install app in the account menu once the browser allows it, and shows its dialog', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/ideas');
    const account = await screen.findByRole('button', { name: 'Account: kat@example.com' });

    await userEvent.click(account);
    expect(screen.queryByRole('menuitem', { name: 'Install app' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    const { event, prompt } = offerInstall();
    await userEvent.click(account);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Install app' }));

    expect(event.defaultPrevented).toBe(true);
    expect(prompt).toHaveBeenCalledOnce();
    await userEvent.click(account);
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Install app' })).not.toBeInTheDocument());
  });

  it('stops offering it once the app is installed', async () => {
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/ideas');
    const account = await screen.findByRole('button', { name: 'Account: kat@example.com' });
    offerInstall();

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    await userEvent.click(account);

    expect(screen.queryByRole('menuitem', { name: 'Install app' })).not.toBeInTheDocument();
  });
});
