import { vi } from 'vitest';

/** Makes the screen as narrow as a phone's: `max-width` media queries match, others (such as dark mode) do not. */
export function narrowScreen() {
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: media.includes('max-width'),
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}
