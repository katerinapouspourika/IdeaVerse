import type { RouteObject } from 'react-router';

import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { ContactPage } from './marketing/ContactPage';
import { HomePage } from './marketing/HomePage';
import { HowItWorksPage } from './marketing/HowItWorksPage';
import { AuthPage } from './pages/AuthPage';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

/**
 * Signed-in pages load on first visit, so the public pages do not download the whole app.
 * Their paths are listed again in the API's `WebAppExtensions.AppRoutes`, which serves the app shell for them; keep both in step.
 */
const signedIn: RouteObject[] = [
  { path: '/ideas', lazy: async () => ({ Component: (await import('./pages/IdeasPage')).IdeasPage }) },
  { path: '/ideas/:id', lazy: async () => ({ Component: (await import('./pages/IdeaPage')).IdeaPage }) },
  { path: '/notifications', lazy: async () => ({ Component: (await import('./pages/NotificationsPage')).NotificationsPage }) },
  { path: '/people', lazy: async () => ({ Component: (await import('./pages/PeoplePage')).PeoplePage }) },
  { path: '/invitations', lazy: async () => ({ Component: (await import('./pages/InvitationsPage')).InvitationsPage }) },
  { path: '/workspaces/new', lazy: async () => ({ Component: (await import('./pages/NewWorkspacePage')).NewWorkspacePage }) },
  { path: '/settings', lazy: async () => ({ Component: (await import('./pages/SettingsPage')).SettingsPage }) },
];

/** Shown while a signed-in page's code downloads on first load. */
function Loading() {
  return <p className="muted">Loading…</p>;
}

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      // Distinct keys give each card its own state, so switching between them starts with empty fields.
      { path: '/login', element: <AuthPage key="login" mode="login" /> },
      { path: '/register', element: <AuthPage key="register" mode="register" /> },
      { path: '/confirm-email', element: <ConfirmEmailPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/', element: <HomePage /> },
      { path: '/how-it-works', element: <HowItWorksPage /> },
      { path: '/contact', element: <ContactPage /> },
      { element: <RequireAuth />, HydrateFallback: Loading, children: signedIn },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
