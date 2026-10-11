import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  /** The id of the element that names the dialog. */
  labelledBy: string;
  /** Its `restore` is set to `false` once the dialog has taken the user somewhere else, where focus belongs to the new page. */
  focus?: { restore: boolean };
  className?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A modal dialog near the top of the screen: Escape or a click beside it closes it, Tab stays inside, and focus returns
 * where it was. The first control marked `data-autofocus`, else the first focusable one, gets focus when it opens.
 * It is drawn on the page's body, since the header that opens it would otherwise confine it.
 */
export function Dialog({ labelledBy, focus, className, onClose, children }: DialogProps) {
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = dialog.current?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog.current?.querySelector<HTMLElement>(focusable);
    first?.focus();
    return () => {
      if (focus?.restore !== false) {
        previous?.focus();
      }
    };
  }, [focus]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Tab') {
      const items = [...(dialog.current?.querySelectorAll<HTMLElement>(focusable) ?? [])];
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  return createPortal(
    <div className="modal-backdrop top" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialog} className={className ? `modal card ${className}` : 'modal card'} role="dialog" aria-modal="true" aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
