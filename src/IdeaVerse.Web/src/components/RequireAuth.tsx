import { WifiOff } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import { Skeleton } from './Skeleton';

/**
 * Shows its routes only to signed-in users; everyone else goes to the login page. When the API can't be reached, as when
 * offline, it says so instead of treating the user as signed out.
 */
export function RequireAuth() {
  const { account, isLoading, unreachable, retry } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <Skeleton variant="page" lines={4} />;
  }

  if (!account && unreachable) {
    return (
      <div className="card empty stack center" role="alert">
        <span className="feature-icon big" aria-hidden="true">
          <WifiOff size={32} />
        </span>
        <h1>Can’t reach IdeaVerse</h1>
        <p className="muted">Check your connection. This page comes back on its own once you’re online again.</p>
        <button type="button" className="button primary" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }

  if (!account) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
