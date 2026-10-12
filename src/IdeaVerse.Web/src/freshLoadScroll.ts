import type { Location } from 'react-router';

/** Where React Router's <ScrollRestoration> keeps each page's scroll position for the tab. */
const storageKey = 'react-router-scroll-positions';

/**
 * The key a page's scroll position is saved under. React Router keys the first page of every load "default", so pages
 * opened afresh would all share one position; keying those by path keeps each page's own, for Back and reload.
 */
export function scrollKey(location: Pick<Location, 'key' | 'pathname'>) {
  return location.key === 'default' ? `first:${location.pathname}` : location.key;
}

/**
 * Makes a page opened afresh (typed into the address bar, or followed from another site) start at the top, rather than
 * where that page was left the last time it was opened this way in the tab. Reloads and Back/Forward keep their place.
 */
export function startFreshLoadsAtTop(
  pathname = location.pathname,
  navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined,
) {
  if (navigation?.type !== 'navigate') {
    return;
  }
  try {
    const positions = JSON.parse(sessionStorage.getItem(storageKey) ?? '{}') as Record<string, number>;
    const key = scrollKey({ key: 'default', pathname });
    if (key in positions) {
      delete positions[key];
      sessionStorage.setItem(storageKey, JSON.stringify(positions));
    }
  } catch {
    // Storage blocked or unreadable: nothing is restored from it either.
  }
}
