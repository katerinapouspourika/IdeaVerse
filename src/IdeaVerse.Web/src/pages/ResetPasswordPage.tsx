import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { resetPassword } from '../api/account';
import { ApiError } from '../api/client';
import { Field } from '../components/Field';

/** Turns a reset failure into one readable message. */
function describe(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.fieldErrors.InvalidToken) {
      return 'This reset link has expired or was already used. Ask for a new one.';
    }
    const messages = Object.values(error.fieldErrors).flat();
    if (messages.length > 0) {
      return messages.join(' ');
    }
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

/** Opened from the password reset email; sets a new password with the link's code. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const code = params.get('code') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!email || !code) {
    return (
      <section className="card auth">
        <h1>This link is incomplete</h1>
        <p>Open the link from your reset email again, or ask for a new one.</p>
        <Link to="/forgot-password">Send a new link</Link>
      </section>
    );
  }

  if (done) {
    return (
      <section className="card auth">
        <h1>Password changed</h1>
        <p>You can now sign in with your new password.</p>
        <Link to="/login" className="button primary">
          Sign in
        </Link>
      </section>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) {
      setError('The two passwords don’t match.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await resetPassword(email, code, password);
      setDone(true);
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="card auth">
      <h1>Choose a new password</h1>
      <p className="muted">
        For <strong>{email}</strong>
      </p>
      <form onSubmit={(event) => void submit(event)} className="stack">
        <Field label="New password" hint="At least 6 characters, with an uppercase letter, a digit, and a symbol.">
          {(props) => (
            <input {...props} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <Field label="Repeat new password">
          {(props) => (
            <input {...props} type="password" autoComplete="new-password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          )}
        </Field>
        {error && (
          <p role="alert" className="error">
            {error} {error.includes('expired') && <Link to="/forgot-password">Send a new link</Link>}
          </p>
        )}
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </section>
  );
}
