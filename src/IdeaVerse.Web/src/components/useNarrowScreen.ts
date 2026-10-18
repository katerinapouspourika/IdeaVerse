import { useSyncExternalStore } from 'react';

/** The stylesheet's phone breakpoint. */
const narrowQuery = '(max-width: 600px)';

const list = () => (typeof window === 'undefined' ? undefined : window.matchMedia?.(narrowQuery));

const subscribe = (onChange: () => void) => {
  const query = list();
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
};

/**
 * Whether the screen is as narrow as a phone's, for layouts that change shape there rather than only restyle. False
 * where there is no `matchMedia`, as when prerendering or in tests, so those render the wide layout.
 */
export function useNarrowScreen(): boolean {
  return useSyncExternalStore(subscribe, () => list()?.matches ?? false, () => false);
}
