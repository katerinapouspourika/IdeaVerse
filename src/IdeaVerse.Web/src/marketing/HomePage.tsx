import { useAuth } from '../auth/AuthContext';
import { DashboardPage } from '../pages/DashboardPage';
import { LandingPage } from './LandingPage';

/** `/`: the dashboard for signed-in users, the public home page for everyone else. */
export function HomePage() {
  const { account, isLoading } = useAuth();

  if (isLoading) {
    return <p className="muted">Loading…</p>;
  }

  return account ? <DashboardPage /> : <LandingPage />;
}
