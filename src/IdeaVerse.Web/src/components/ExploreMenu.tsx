import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FocusEvent } from 'react';
import { Link, useLocation } from 'react-router';

/** The pages grouped under Explore in the public header. */
export const explorePages = [
  { to: '/templates', label: 'Templates', blurb: 'Ready-made ideas to start from' },
  { to: '/use-cases', label: 'Use cases', blurb: 'How different teams use IdeaVerse' },
  { to: '/compare', label: 'Compare', blurb: 'IdeaVerse next to other ways of working' },
] as const;

/**
 * Explore in the public header: a button that shows links to the templates, use cases, and comparisons on wide
 * screens, and a labelled group of the same links in the small-screen menu (rendered only while that menu is open). Escape, a click elsewhere, moving focus
 * away, or opening a page closes it.
 */
export function ExploreMenu({ inOpenMenu }: { inOpenMenu: boolean }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const current = explorePages.some((page) => pathname === page.to || pathname.startsWith(`${page.to}/`));

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOutside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const closeWhenFocusLeaves = (event: FocusEvent) => {
    if (!root.current?.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
    }
  };

  return (
    <div className="nav-group" ref={root} onBlur={closeWhenFocusLeaves}>
      <button
        ref={button}
        type="button"
        className={current ? 'nav-link nav-group-toggle active' : 'nav-link nav-group-toggle'}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        Explore
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      <p className="nav-group-heading">Explore</p>
      {(open || inOpenMenu) && (
      <ul id={panelId} className={open ? 'nav-panel open' : 'nav-panel'}>
        {explorePages.map((page) => (
          <li key={page.to}>
            <Link to={page.to} className="nav-panel-link" aria-current={pathname === page.to ? 'page' : undefined}>
              <span className="nav-panel-label">{page.label}</span>
              <span className="nav-panel-blurb">{page.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}
