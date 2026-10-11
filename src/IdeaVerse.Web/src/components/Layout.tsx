import { Download, LogOut, Menu as MenuIcon, Settings, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router';

import { useReceivedInvitations } from '../api/queries';
import { personLabel } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Commands } from '../commands/Commands';
import { useWorkspace, WorkspaceProvider } from '../workspaces/WorkspaceContext';
import { WorkspaceSwitcher } from '../workspaces/WorkspaceSwitcher';
import { FeedbackProvider } from './Feedback';
import { Menu } from './Menu';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { useInstallPrompt } from './useInstallPrompt';

/** Pages that lay themselves out across the full width, such as the public home page. */
const fullWidthPaths = ['/how-it-works', '/contact'];

export function Layout() {
  const { account } = useAuth();
  const { pathname } = useLocation();
  const fullWidth = fullWidthPaths.includes(pathname) || (pathname === '/' && !account);
  const main = useFocusOnNavigation();

  return (
    <WorkspaceProvider>
      <FeedbackProvider>
        <div className="shell">
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          {account ? <AppBar /> : <PublicBar />}
          <main id="main" ref={main} tabIndex={-1} className={fullWidth ? 'content full' : account ? 'content wide' : 'content'}>
            <Outlet />
          </main>
          <Footer />
        </div>
        <ScrollRestoration />
      </FeedbackProvider>
    </WorkspaceProvider>
  );
}

/** Moves focus to the page after each navigation, so keyboard and screen reader users start at its content. */
function useFocusOnNavigation() {
  const main = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.focus({ preventScroll: true });
  }, [pathname]);

  return main;
}

function Brand() {
  return (
    <Link to="/" className="brand">
      <img src="/logo.png" alt="" className="logo" width="34" height="34" />
      IdeaVerse
    </Link>
  );
}

/** Opens and closes the small-screen menu, closing it again whenever the page changes. */
function useMenu() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  return { open, toggle: () => setOpen((o) => !o) };
}

function MenuButton({ open, toggle }: { open: boolean; toggle: () => void }) {
  return (
    <button type="button" className="menu-button" aria-expanded={open} aria-controls="site-menu" aria-label="Menu" onClick={toggle}>
      {open ? <X aria-hidden="true" size={22} /> : <MenuIcon aria-hidden="true" size={22} />}
    </button>
  );
}

function AppBar() {
  const { account, logout } = useAuth();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const menu = useMenu();
  const { install } = useInstallPrompt();

  const signOut = async () => {
    await logout();
    // Tells the sign-in page not to send the user back in while it still sees the account it just dropped.
    await navigate('/login', { state: { signedOut: true } });
  };

  return (
    <header className="topbar">
      <Brand />
      <nav id="site-menu" className={menu.open ? 'site-menu app open' : 'site-menu app'} aria-label="Main">
        <WorkspaceSwitcher />
        <NavLink to="/" end className="nav-link">
          Home
        </NavLink>
        {current && (
          <NavLink to="/ideas" className="nav-link">
            Ideas
          </NavLink>
        )}
        {current && (
          <NavLink to="/people" className="nav-link">
            People
          </NavLink>
        )}
        <InvitationsLink />
      </nav>
      <div className="account">
        <Commands />
        <ThemeToggle />
        <NotificationBell />
        {account && (
          <Menu
            label={`Account: ${personLabel(account.displayName, account.email)}`}
            trigger={
              <>
                <span className="avatar" aria-hidden="true">
                  {initial(account.displayName, account.email)}
                </span>
                <span className="account-name">{personLabel(account.displayName, account.email)}</span>
              </>
            }
            items={[
              { label: 'Settings', icon: <Settings aria-hidden="true" size={16} />, onSelect: () => void navigate('/settings') },
              ...(install ? [{ label: 'Install app', icon: <Download aria-hidden="true" size={16} />, onSelect: () => void install() }] : []),
              { label: 'Sign out', icon: <LogOut aria-hidden="true" size={16} />, onSelect: () => void signOut() },
            ]}
          />
        )}
        <MenuButton {...menu} />
      </div>
    </header>
  );
}

function PublicBar() {
  const menu = useMenu();

  return (
    <header className="topbar">
      <Brand />
      <nav id="site-menu" className={menu.open ? 'site-menu open' : 'site-menu'} aria-label="Main">
        <NavLink to="/how-it-works" className="nav-link">
          How it works
        </NavLink>
        <NavLink to="/contact" className="nav-link">
          Contact
        </NavLink>
        <NavLink to="/login" className="nav-link">
          Sign in
        </NavLink>
        <Link to="/register" className="button primary small">
          Get started
        </Link>
      </nav>
      <div className="account">
        <ThemeToggle />
        <MenuButton {...menu} />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span className="muted small">© {new Date().getFullYear()} IdeaVerse · Plan ideas, together, on time.</span>
        <nav className="row wrap small" aria-label="Footer">
          <Link to="/how-it-works">How it works</Link>
          <Link to="/templates">Templates</Link>
          <Link to="/contact">Contact us</Link>
        </nav>
      </div>
    </footer>
  );
}

/** Header link to the user's open invitations, shown only while they have some. */
function InvitationsLink() {
  const invitations = useReceivedInvitations();
  const count = invitations.data?.length ?? 0;
  return count === 0 ? null : (
    <NavLink to="/invitations" className="nav-link">
      Invitations ({count})
    </NavLink>
  );
}

function initial(name: string | null, email: string): string {
  return (name?.trim() || email).charAt(0).toUpperCase();
}
