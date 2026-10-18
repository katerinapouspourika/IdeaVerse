import { Check } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  /** Set on every item to make the menu a single choice, with the chosen item marked. */
  checked?: boolean;
}

/**
 * A button that opens a short list of actions. Arrow keys move between them, Escape or a click elsewhere closes it,
 * and focus returns to the button.
 */
export function Menu({
  label,
  trigger,
  items,
  triggerClassName = 'button ghost small icon-button',
}: {
  label: string;
  trigger: ReactNode;
  items: MenuItem[];
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const first = root.current?.querySelector<HTMLButtonElement>('.menu-item[aria-checked="true"]') ?? root.current?.querySelector<HTMLButtonElement>('.menu-item');
    first?.focus();
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
    const entries = [...(root.current?.querySelectorAll<HTMLButtonElement>('.menu-item') ?? [])];
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
        className={triggerClassName}
        aria-label={label}
        title={label}
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
              role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
              aria-checked={item.checked}
              className={item.danger ? 'menu-item danger' : 'menu-item'}
              onClick={() => {
                close();
                item.onSelect();
              }}
            >
              {item.icon}
              {item.label}
              {item.checked && <Check className="menu-check" aria-hidden="true" size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
