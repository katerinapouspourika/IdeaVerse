import { useCallback, useRef } from 'react';

/**
 * For a row that scrolls sideways: sets `data-fade` to `start`, `end`, or `both` while more of it lies beyond that
 * edge, so the stylesheet can fade the edge as a hint to scroll. Returns a ref for the row.
 */
export function useEdgeFade<T extends HTMLElement>() {
  const cleanup = useRef<() => void>(undefined);

  return useCallback((row: T | null) => {
    cleanup.current?.();
    cleanup.current = undefined;
    if (!row) {
      return;
    }
    const update = () => {
      // A pixel of slack, as zoomed pages report fractional scroll positions.
      const start = row.scrollLeft > 1;
      const end = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
      const fade = start && end ? 'both' : start ? 'start' : end ? 'end' : undefined;
      if (fade) {
        row.dataset.fade = fade;
      } else {
        delete row.dataset.fade;
      }
    };
    update();
    row.addEventListener('scroll', update, { passive: true });
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    resize?.observe(row);
    // Items come and go (the board has no status tabs), changing how far the row scrolls without resizing it.
    const items = new MutationObserver(update);
    items.observe(row, { childList: true });
    cleanup.current = () => {
      row.removeEventListener('scroll', update);
      resize?.disconnect();
      items.disconnect();
    };
  }, []);
}
