import { Check } from 'lucide-react';
import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface MenuItem {
  /** Tells apart items whose labels may repeat, such as two workspaces of the same name. */
  id?: string;
  label: string;
  icon?: ReactNode;
  /** A second line under the label, such as the user's role in a workspace. */
  detail?: ReactNode;
  /** Draws a line above the item, setting it apart from the ones before it. */
  separated?: boolean;
  onSelect: () => void;
  danger?: boolean;
  /** Set on every item to make the menu a single choice, with the chosen item marked. */
  checked?: boolean;
}

/**
 * A button that opens a short list of actions. Arrow keys, Home and End move between them, Escape or a click elsewhere
 * closes it, and focus returns to the button. `listLabel` names the list when the button's label describes the choice
 * made rather than the list, and `listClassName` styles it.
 */
export function Menu({
  label,
  trigger,
  items,
  triggerClassName = 'button ghost small icon-button',
  listLabel = label,
  listClassName,
}: {
  label: string;
  trigger: ReactNode;
  items: MenuItem[];
  triggerClassName?: string;
  listLabel?: string;
  listClassName?: string;
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
      // Only this menu closes, not a panel or menu around it.
      if (open) {
        event.stopPropagation();
      }
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      entries[(index + step + entries.length) % entries.length]?.focus();
    } else if ((event.key === 'Home' || event.key === 'End') && open) {
      event.preventDefault();
      entries[event.key === 'Home' ? 0 : entries.length - 1]?.focus();
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
        <div id={menuId} className={listClassName ? `menu-list ${listClassName}` : 'menu-list'} role="menu" aria-label={listLabel}>
          {items.map((item) => (
            <Fragment key={item.id ?? item.label}>
              {item.separated && <div role="separator" className="menu-separator" />}
              <button
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
                {item.detail === undefined ? (
                  item.label
                ) : (
                  <span className="menu-item-text">
                    <span className="menu-item-label">{item.label}</span>
                    <span className="visually-hidden">,</span>{' '}
                    <span className="menu-item-detail">{item.detail}</span>
                  </span>
                )}
                {item.checked && <Check className="menu-check" aria-hidden="true" size={16} />}
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
