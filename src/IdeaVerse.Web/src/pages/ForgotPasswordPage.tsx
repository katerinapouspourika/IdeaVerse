import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';

import { forgotPassword } from '../api/account';
import { ErrorMessage } from '../components/ErrorMessage';
import { Field } from '../components/Field';
import { emailProblem, useInlineValidation } from '../components/useInlineValidation';
import { usePageMeta } from '../seo/usePageMeta';

export function ForgotPasswordPage() {
  usePageMeta('Forgot your password', { index: false });
  const location = useLocation();
  // Filled in when they came from "Forgot your password?" after finding their email already has an account.
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const validation = useInlineValidation({ email: () => emailProblem(email) });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validation.validate(event)) {
      return;
    }
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
      <form onSubmit={(event) => void submit(event)} className="stack" noValidate>
        <Field label="Email" error={validation.errors.email}>
          {(props) => (
            <input
              {...props}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={validation.blur('email')}
            />
          )}
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
