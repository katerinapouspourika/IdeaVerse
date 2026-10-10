import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';

import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { AuthPage } from './pages/AuthPage';
import { IdeaPage } from './pages/IdeaPage';
import { IdeasPage } from './pages/IdeasPage';
import { NotificationsPage } from './pages/NotificationsPage';

export const routes = [
  {
    element: <Layout />,
    children: [
      { path: '/login', element: <AuthPage mode="login" /> },
      { path: '/register', element: <AuthPage mode="register" /> },
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
