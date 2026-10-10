import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';

import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { AuthPage } from './pages/AuthPage';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { IdeaPage } from './pages/IdeaPage';
import { IdeasPage } from './pages/IdeasPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

export const routes = [
  {
    element: <Layout />,
    children: [
      { path: '/login', element: <AuthPage mode="login" /> },
      { path: '/register', element: <AuthPage mode="register" /> },
      { path: '/confirm-email', element: <ConfirmEmailPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <IdeasPage /> },
          { path: '/ideas/:id', element: <IdeaPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export function App() {
  return <RouterProvider router={router} />;
}
