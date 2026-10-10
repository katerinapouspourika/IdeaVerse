import { Link, Outlet, useNavigate } from 'react-router';

import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { account, logout } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await logout();
    await navigate('/login');
  };

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          IdeaVerse
        </Link>
        {account && (
          <div className="account">
            <span className="muted">{account.email}</span>
            <button type="button" className="button ghost" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
