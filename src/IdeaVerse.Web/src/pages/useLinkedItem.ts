import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';

/** How long the item a link points at stays highlighted. */
const highlightMs = 2500;

/**
 * Brings the item the address points at (`#comment-…` or `#component-…`, as notifications link them) into view once its
 * list has loaded: scrolls it to the middle, smoothly unless the user prefers reduced motion, moves focus to it so keyboard
 * and screen reader users carry on from there, and returns its id while it is briefly highlighted. Each visit to the
 * address does this once; a link to an item that no longer exists leaves the page as it opened.
 */
export function useLinkedItem(prefix: 'comment' | 'component', ids: string[] | undefined): string | null {
  const { hash, key } = useLocation();
  const handled = useRef<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const id = hash.startsWith(`#${prefix}-`) ? decodeURIComponent(hash.slice(prefix.length + 2)) : null;
  const found = id !== null && (ids?.includes(id) ?? false);

  useEffect(() => {
    if (!found || handled.current === key) {
      return;
    }
    // Waits for the layout to finish moving focus to the page after a navigation, so focus ends up on the item.
    const timer = window.setTimeout(() => {
      const element = document.getElementById(`${prefix}-${id}`);
      if (!element) {
        return;
      }
      handled.current = key;
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      element.scrollIntoView?.({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
      element.focus({ preventScroll: true });
      setHighlighted(id);
    });
    return () => window.clearTimeout(timer);
  }, [found, key, id, prefix]);

  useEffect(() => {
    if (highlighted === null) {
      return;
    }
    const timer = window.setTimeout(() => setHighlighted(null), highlightMs);
    return () => window.clearTimeout(timer);
  }, [highlighted]);

  return highlighted;
}
