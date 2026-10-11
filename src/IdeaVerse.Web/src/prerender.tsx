import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { AuthProvider } from './auth/AuthContext';
import { walkthroughs, walkthroughsRecordedOn } from './marketing/walkthroughs';
import { routes } from './routes';
import { fullTitle, notFoundMeta, publicPages, shareImagePath, siteDescription, siteName } from './seo/pages';

/**
 * Entry point for `scripts/prerender.mjs`, built with `vite build --ssr`: renders a public page to HTML as a signed-out
 * visitor sees it, so search engines, AI crawlers, and link previews get real content without running the app.
 */
export function render(path: string): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return renderToString(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

export { fullTitle, notFoundMeta, publicPages, shareImagePath, siteDescription, siteName, walkthroughs, walkthroughsRecordedOn };
