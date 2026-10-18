import { Link } from 'react-router';

import { useAuth } from '../auth/AuthContext';

/**
 * The gradient band that closes a public page with a way in: sign up, or go to the app when already signed in, beside
 * a way to talk to the team.
 */
export function CtaBand({ title, text }: { title: string; text: string }) {
  const { account } = useAuth();
  return (
    <section className="landing-section">
      <div className="landing-inner">
        <div className="cta-band">
          <h2 className="section-title">{title}</h2>
          <p className="lead">{text}</p>
          <div className="row wrap center-row">
            {account ? (
              <Link to="/ideas" className="button light large">
                Go to your ideas
              </Link>
            ) : (
              <Link to="/register" className="button light large">
                Get started free
              </Link>
            )}
            <Link to="/contact" className="button outline-light large">
              Talk to us
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
