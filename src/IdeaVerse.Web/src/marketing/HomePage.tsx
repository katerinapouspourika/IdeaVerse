import { lazy, Suspense } from 'react';

import { hadSession } from '../auth/sessionHint';
import { useAuth } from '../auth/AuthContext';
import { LandingPage } from './LandingPage';

const DashboardPage = lazy(() => import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));

const loading = <p className="muted">Loading…</p>;

/**
 * `/`: the dashboard for signed-in users, the public home page for everyone else.
 * While the account loads, visitors already see the home page (as prerendered), and returning users wait for their dashboard.
 */
export function HomePage() {
  const { account, isLoading } = useAuth();

  if (account) {
    return (
      <Suspense fallback={loading}>
        <DashboardPage />
      </Suspense>
    );
  }

  return isLoading && hadSession() ? loading : <LandingPage />;
}
