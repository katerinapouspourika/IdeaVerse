import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

/** How far a mouse or pen must move before a press becomes a drag. */
const dragSlop = 6;
/** How far a finger may wander while held before the press counts as a scroll instead. */
const touchSlop = 10;
/** How long a finger must rest on an item to pick it up; moving sooner scrolls the page as usual. */
export const longPressMs = 400;
/** How close to an edge of the container or the screen the pointer scrolls it, and by how much per frame. */
const scrollEdge = 56;
const scrollStep = 10;

/** An item being dragged: the drop target under the pointer, and where its preview sits on the screen. */
export interface PointerDrag<T extends string> {
  id: string;
  over: T | null;
  left: number;
  top: number;
  width: number;
}

interface Press {
  pointerId: number;
  touch: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  active: boolean;
  timer?: number;
  frame?: number;
  end: () => void;
}

/**
 * Dragging items between drop targets with Pointer Events, so it works with a mouse, a pen, and touch, where HTML drag
 * and drop never starts. A mouse or pen drags once it moves a few pixels; a finger must rest on the item for
 * `longPressMs` first, so a swipe still scrolls. Near the container's sides or the screen's top and bottom the view
 * scrolls along, and Escape cancels. Drop targets are the container's elements with a `data-drop` value.
 *
 * Returns a ref for the container, the drag in progress (or null), and the handlers for each draggable item.
 */
export function usePointerDrag<T extends string>(onDrop: (id: string, target: T) => void) {
  const container = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const drop = useRef(onDrop);
  const [drag, setDrag] = useState<PointerDrag<T> | null>(null);

  useEffect(() => {
    drop.current = onDrop;
  });

  useEffect(() => {
    const element = container.current;
    // Once a finger has picked an item up, its moves drag the item instead of scrolling the page.
    const hold = (event: TouchEvent) => {
      if (press.current?.active) {
        event.preventDefault();
      }
    };
    element?.addEventListener('touchmove', hold, { passive: false });
    return () => {
      element?.removeEventListener('touchmove', hold);
      press.current?.end();
    };
  }, []);

  const targetAt = (x: number, y: number) => {
    for (const target of container.current?.querySelectorAll<HTMLElement>('[data-drop]') ?? []) {
      const box = target.getBoundingClientRect();
      if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
        return target.dataset.drop as T;
      }
    }
    return null;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    // An open menu's items are for choosing, not dragging.
    if (!event.isPrimary || event.button !== 0 || press.current || (event.target as Element).closest('[role="menu"]')) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const p: Press = {
      pointerId: event.pointerId,
      touch: event.pointerType === 'touch',
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      offsetX: event.clientX - box.left,
      offsetY: event.clientY - box.top,
      width: box.width,
      active: false,
      end: () => {
        window.clearTimeout(p.timer);
        if (p.frame !== undefined) {
          cancelAnimationFrame(p.frame);
        }
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', p.end);
        window.removeEventListener('keydown', escape);
        press.current = null;
        setDrag(null);
      },
    };
    press.current = p;

    const show = () => setDrag({ id, over: targetAt(p.x, p.y), left: p.x - p.offsetX, top: p.y - p.offsetY, width: p.width });
    const scroll = () => {
      const area = container.current?.getBoundingClientRect();
      // Nothing to measure where nothing is laid out, as in tests.
      if (container.current && area && area.width > 0) {
        const dx = p.x < area.left + scrollEdge ? -scrollStep : p.x > area.right - scrollEdge ? scrollStep : 0;
        const dy = p.y < scrollEdge ? -scrollStep : p.y > window.innerHeight - scrollEdge ? scrollStep : 0;
        if (dx !== 0) {
          container.current.scrollLeft += dx;
        }
        if (dy !== 0) {
          window.scrollBy(0, dy);
        }
        if (dx !== 0 || dy !== 0) {
          show();
        }
      }
      p.frame = requestAnimationFrame(scroll);
    };
    const activate = () => {
      p.active = true;
      show();
      p.frame = requestAnimationFrame(scroll);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== p.pointerId) {
        return;
      }
      p.x = e.clientX;
      p.y = e.clientY;
      if (p.active) {
        e.preventDefault();
        show();
      } else if (Math.hypot(p.x - p.startX, p.y - p.startY) > (p.touch ? touchSlop : dragSlop)) {
        // A finger that moves before the long press is scrolling; a mouse or pen that moves is dragging.
        if (p.touch) {
          p.end();
        } else {
          activate();
        }
      }
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== p.pointerId) {
        return;
      }
      const target = p.active ? targetAt(e.clientX, e.clientY) : null;
      if (p.active) {
        swallowClick();
      }
      p.end();
      if (target) {
        drop.current(id, target);
      }
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && p.active) {
        e.preventDefault();
        p.end();
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', p.end);
    window.addEventListener('keydown', escape);
    if (p.touch) {
      p.timer = window.setTimeout(activate, longPressMs);
    }
  };

  /** Keeps a long press from opening the browser's menu for the link under the finger. */
  const onContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    if (press.current?.touch) {
      event.preventDefault();
    }
  };

  return { container, drag, onPointerDown, onContextMenu };
}

/** Swallows the click that ends a drag, so dropping a card doesn't also open it or the menu it was picked up by. */
function swallowClick() {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
}
