import { useCallback, useSyncExternalStore } from 'react';

/** The width at and below which the signed-in app lays itself out for a phone; matches the CSS that moves toasts to the top. */
export const phoneQuery = '(max-width: 700px)';

/** Whether the media query matches now, following it as the window changes; false where there is no window, as when prerendering. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia?.(query);
      list?.addEventListener('change', onChange);
      return () => list?.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}
