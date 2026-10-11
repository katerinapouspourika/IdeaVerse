import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import { Skeleton } from './Skeleton';

/** Shows its routes only to signed-in users; everyone else goes to the login page. */
export function RequireAuth() {
  const { account, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <Skeleton variant="page" lines={4} />;
  }

  if (!account) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
