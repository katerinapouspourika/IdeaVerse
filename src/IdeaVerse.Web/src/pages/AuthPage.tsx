import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Field } from '../components/Field';

type Mode = 'login' | 'register';

const copy: Record<Mode, { title: string; action: string; switchText: string; switchLink: string; switchTo: string }> = {
  login: { title: 'Sign in', action: 'Sign in', switchText: 'New to IdeaVerse?', switchLink: 'Create an account', switchTo: '/register' },
  register: { title: 'Create your account', action: 'Create account', switchText: 'Already have an account?', switchLink: 'Sign in', switchTo: '/login' },
};

/** Turns an Identity error response into one readable message. */
function describe(error: unknown, mode: Mode): string {
  if (error instanceof ApiError) {
    if (mode === 'login' && error.status === 401) {
      return 'That email and password do not match.';
    }
    const messages = Object.values(error.fieldErrors).flat();
    if (messages.length > 0) {
      return messages.join(' ');
    }
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export function AuthPage({ mode }: { mode: Mode }) {
  const { account, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const text = copy[mode];

  if (account) {
    return <Navigate to="/" replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await (mode === 'login' ? login(email, password) : register(email, password));
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      await navigate(from, { replace: true });
    } catch (caught) {
      setError(describe(caught, mode));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="card auth">
      <h1>{text.title}</h1>
      <p className="muted">Plan ideas, line up what they need, and never lose track of a date.</p>
      <form onSubmit={(event) => void submit(event)} className="stack">
        <Field label="Email">
          {(props) => (
            <input {...props} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        <Field
          label="Password"
          hint={mode === 'register' ? 'At least 6 characters, with an uppercase letter, a digit, and a symbol.' : undefined}
        >
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? 'Please wait…' : text.action}
        </button>
      </form>
      <p className="muted small">
        {text.switchText} <Link to={text.switchTo}>{text.switchLink}</Link>
      </p>
    </section>
  );
}
