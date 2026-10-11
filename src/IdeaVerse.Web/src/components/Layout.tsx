import { Link, NavLink, Outlet, useNavigate } from 'react-router';

import { useReceivedInvitations } from '../api/queries';
import { personLabel } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useWorkspace, WorkspaceProvider } from '../workspaces/WorkspaceContext';
import { WorkspaceSwitcher } from '../workspaces/WorkspaceSwitcher';
import { NotificationBell } from './NotificationBell';

export function Layout() {
  return (
    <WorkspaceProvider>
      <div className="shell">
        <TopBar />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </WorkspaceProvider>
  );
}

function TopBar() {
  const { account, logout } = useAuth();
  const { current } = useWorkspace();
  const navigate = useNavigate();

  const signOut = async () => {
    await logout();
    await navigate('/login');
  };

  return (
    <header className="topbar">
      <div className="row">
        <Link to="/" className="brand">
          <img src="/logo.png" alt="" className="logo" width="32" height="32" />
          IdeaVerse
        </Link>
        {account && <WorkspaceSwitcher />}
        {account && current && (
          <NavLink to="/people" className="nav-link">
            People
          </NavLink>
        )}
        {account && <InvitationsLink />}
      </div>
      {account && (
        <div className="account">
          <NotificationBell />
          <Link to="/settings" className="muted account-link" title="Settings">
            {personLabel(account.displayName, account.email)}
          </Link>
          <button type="button" className="button ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      )}
    </header>
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
