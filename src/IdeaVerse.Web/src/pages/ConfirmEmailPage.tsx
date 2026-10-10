import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { confirmEmail } from '../api/account';

type State = 'confirming' | 'confirmed' | 'failed';

/** Opened from the confirmation email; confirms the account with the link's code. */
export function ConfirmEmailPage() {
  const { search } = useLocation();
  const [state, setState] = useState<State>('confirming');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    confirmEmail(search).then(
      () => setState('confirmed'),
      () => setState('failed'),
    );
  }, [search]);

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
    </section>
  );
}
