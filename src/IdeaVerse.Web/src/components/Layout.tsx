import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';

import { useReceivedInvitations } from '../api/queries';
import { personLabel } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useWorkspace, WorkspaceProvider } from '../workspaces/WorkspaceContext';
import { WorkspaceSwitcher } from '../workspaces/WorkspaceSwitcher';
import { NotificationBell } from './NotificationBell';

/** Pages that lay themselves out across the full width, such as the public home page. */
const fullWidthPaths = ['/how-it-works', '/contact'];

export function Layout() {
  const { account } = useAuth();
  const { pathname } = useLocation();
  const fullWidth = fullWidthPaths.includes(pathname) || (pathname === '/' && !account);

  return (
    <WorkspaceProvider>
      <div className="shell">
        {account ? <AppBar /> : <PublicBar />}
        <main className={fullWidth ? 'content full' : pathname === '/' ? 'content wide' : 'content'}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </WorkspaceProvider>
  );
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
      <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
      </svg>
    </button>
  );
}

function AppBar() {
  const { account, logout } = useAuth();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const menu = useMenu();

  const signOut = async () => {
    await logout();
    await navigate('/login');
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
        <span className="nav-spacer" />
        {account && (
          <Link to="/settings" className="account-link" title="Settings">
            <span className="avatar" aria-hidden="true">
              {initial(account.displayName, account.email)}
            </span>
            <span className="account-name">{personLabel(account.displayName, account.email)}</span>
          </Link>
        )}
        <button type="button" className="button ghost small" onClick={() => void signOut()}>
          Sign out
        </button>
      </nav>
      <div className="account">
        <NotificationBell />
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
      <MenuButton {...menu} />
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
