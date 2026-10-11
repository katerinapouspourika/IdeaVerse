import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

/**
 * A button that opens a short list of actions. Arrow keys move between them, Escape or a click elsewhere closes it,
 * and focus returns to the button.
 */
export function Menu({ label, trigger, items }: { label: string; trigger: ReactNode; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const closeOutside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const entries = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const index = entries.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      entries[(index + step + entries.length) % entries.length]?.focus();
    }
  };

  return (
    <div className="menu" ref={root} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className="button ghost small icon-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open && (
        <div id={menuId} className="menu-list" role="menu" aria-label={label}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? 'menu-item danger' : 'menu-item'}
              onClick={() => {
                close();
                item.onSelect();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
