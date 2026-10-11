import { Link } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import { notFoundMeta } from '../seo/pages';
import { usePageMeta } from '../seo/usePageMeta';

/** Shown for addresses that match no page; the server answers them with status 404. */
export function NotFoundPage() {
  usePageMeta(notFoundMeta.title, { description: notFoundMeta.description, index: false });
  const { account } = useAuth();

  return (
    <section className="card stack center not-found">
      <img src="/logo.png" alt="" className="logo auth-logo" width="72" height="72" />
      <h1>Page not found</h1>
      <p className="muted">The address may be mistyped, or the page may have moved.</p>
      <div className="row wrap center-row">
        <Link to="/" className="button primary">
          Go to the home page
        </Link>
        {account && (
          <Link to="/ideas" className="button">
            Your ideas
          </Link>
        )}
      </div>
    </section>
  );
}
