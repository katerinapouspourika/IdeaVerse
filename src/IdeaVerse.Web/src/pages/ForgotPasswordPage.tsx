import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';

import { forgotPassword } from '../api/account';
import { ErrorMessage } from '../components/ErrorMessage';
import { Field } from '../components/Field';
import { usePageMeta } from '../seo/usePageMeta';

export function ForgotPasswordPage() {
  usePageMeta('Forgot your password', { index: false });
  const location = useLocation();
  // Filled in from the sign-in form, where they may have typed it already.
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <section className="card auth">
        <h1>Check your inbox</h1>
        <p>
          If an account uses <strong>{email}</strong>, we’ve sent it a link to choose a new password. The link works for one day.
        </p>
        <Link to="/login">Back to sign in</Link>
      </section>
    );
  }

  return (
    <section className="card auth">
      <h1>Reset your password</h1>
      <p className="muted">Enter your account’s email and we’ll send you a link to choose a new password.</p>
      <form onSubmit={(event) => void submit(event)} className="stack">
        <Field label="Email">
          {(props) => <input {...props} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <ErrorMessage error={error} />
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="muted small">
        Remembered it? <Link to="/login">Sign in</Link>
      </p>
    </section>
  );
}
