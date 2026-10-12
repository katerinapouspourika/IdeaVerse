import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';

import { afterSignIn } from '../auth/afterSignIn';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Feedback';
import { usePageMeta } from '../seo/usePageMeta';

type State = 'confirming' | 'signedIn' | 'confirmed' | 'failed' | 'incomplete';

/**
 * Opened from the confirmation email; confirms the account with the link's code. A new account is signed in and taken
 * to its ideas; a link for an address already confirmed, or a change of address, asks them to sign in as usual.
 */
export function ConfirmEmailPage() {
  usePageMeta('Confirm your email', { index: false });
  const { search } = useLocation();
  const { confirmEmail } = useAuth();
  const toast = useToast();
  const params = new URLSearchParams(search);
  const complete = Boolean(params.get('userId') && params.get('code'));
  const [state, setState] = useState<State>(complete ? 'confirming' : 'incomplete');
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !complete) {
      return;
    }
    started.current = true;
    confirmEmail(search).then(
      ({ signedIn }) => {
        if (signedIn) {
          toast({ message: 'Email confirmed. Welcome to IdeaVerse!', tone: 'success' });
        }
        setState(signedIn ? 'signedIn' : 'confirmed');
      },
      () => setState('failed'),
    );
  }, [search, complete, confirmEmail, toast]);

  if (state === 'signedIn') {
    return <Navigate to={afterSignIn('/ideas')} replace />;
  }

  return (
    <section className="card auth">
      {state === 'confirming' && <p className="muted">Confirming your email…</p>}
      {state === 'confirmed' && (
        <>
          <h1>Email confirmed</h1>
          <p>Your account is ready.</p>
          <Link to="/login" className="button primary">
            Sign in
          </Link>
        </>
      )}
      {state === 'failed' && (
        <>
          <h1>This link didn’t work</h1>
          <p>It may have expired or already been used. Try signing in; if your email still needs confirming, you can ask for a new link there.</p>
          <Link to="/login" className="button">
            Go to sign in
          </Link>
        </>
      )}
      {state === 'incomplete' && (
        <>
          <h1>This link is incomplete</h1>
          <p>Open the link from your confirmation email again. If it still doesn’t work, sign in to ask for a new one.</p>
          <Link to="/login" className="button">
            Go to sign in
          </Link>
        </>
      )}
    </section>
  );
}
