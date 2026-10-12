import type { RouteObject } from 'react-router';

import { Layout, type PageHandle } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { Skeleton } from './components/Skeleton';
import { ContactPage } from './marketing/ContactPage';
import { HomePage } from './marketing/HomePage';
import { HowItWorksPage } from './marketing/HowItWorksPage';
import { PricingPage } from './marketing/PricingPage';
import { LegalPage } from './legal/LegalPage';
import { privacyPolicy, terms } from './legal/legal';
import { ComparisonPage, ComparisonsPage, UseCasePage, UseCasesPage } from './solutions/SolutionPages';
import { TemplatePage } from './templates/TemplatePage';
import { TemplatesPage } from './templates/TemplatesPage';
import { AuthPage } from './pages/AuthPage';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { publicPages } from './seo/pages';

/** Marks a page that lays itself out across the full width, with its hero and bands running edge to edge. */
const fullWidth: PageHandle = { fullWidth: true };

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
  return <Skeleton variant="page" lines={4} />;
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
      { path: '/how-it-works', handle: fullWidth, element: <HowItWorksPage /> },
      { path: '/contact', handle: fullWidth, element: <ContactPage /> },
      { path: '/pricing', handle: fullWidth, element: <PricingPage /> },
      { path: '/privacy', handle: fullWidth, element: <LegalPage document={privacyPolicy} description={publicPages['/privacy'].description} /> },
      { path: '/terms', handle: fullWidth, element: <LegalPage document={terms} description={publicPages['/terms'].description} /> },
      { path: '/templates', handle: fullWidth, element: <TemplatesPage /> },
      { path: '/templates/:slug', handle: fullWidth, element: <TemplatePage /> },
      { path: '/use-cases', handle: fullWidth, element: <UseCasesPage /> },
      { path: '/use-cases/:slug', handle: fullWidth, element: <UseCasePage /> },
      { path: '/compare', handle: fullWidth, element: <ComparisonsPage /> },
      { path: '/compare/:slug', handle: fullWidth, element: <ComparisonPage /> },
      { element: <RequireAuth />, HydrateFallback: Loading, children: signedIn },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
