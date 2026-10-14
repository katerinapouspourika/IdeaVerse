import { useEffect, useState, type FormEvent } from 'react';
import { AlarmClock, Lightbulb, Puzzle, Users } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';

import { ApiError } from '../api/client';
import { afterSignIn } from '../auth/afterSignIn';
import { useAuth } from '../auth/AuthContext';
import { readAccountProblems, type AccountProblems } from '../auth/identityErrors';
import { meetsPasswordRules } from '../auth/passwordRules';
import { PasswordRules } from '../auth/PasswordRules';
import { Field } from '../components/Field';
import { ResendConfirmation } from '../components/ResendConfirmation';
import { emailProblem, useInlineValidation } from '../components/useInlineValidation';
import { usePageMeta } from '../seo/usePageMeta';
import { rememberTemplate } from '../templates/pendingTemplate';
import { findTemplate } from '../templates/templates';

type Mode = 'login' | 'register';

const copy: Record<Mode, { title: string; action: string; switchText: string; switchLink: string; switchTo: string }> = {
  login: { title: 'Sign in', action: 'Sign in', switchText: 'New to IdeaVerse?', switchLink: 'Create account', switchTo: '/register' },
  register: { title: 'Create your account', action: 'Create account', switchText: 'Already have an account?', switchLink: 'Sign in', switchTo: '/login' },
};

/** Identity's login failure detail for an account whose email is not confirmed yet. */
const notConfirmed = 'NotAllowed';

/** Identity's login failure detail for an account locked after too many wrong passwords. */
const lockedOut = 'LockedOut';

/** Turns an Identity error response into one readable message. */
function describe(error: unknown, mode: Mode): string {
  if (error instanceof ApiError) {
    if (mode === 'login' && error.status === 401) {
      if (error.message === notConfirmed) {
        return 'Please confirm your email first. We sent you a link when you signed up.';
      }
      if (error.message === lockedOut) {
        return 'Too many attempts. Please wait a few minutes, or reset your password.';
      }
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
  usePageMeta(mode === 'login' ? 'Sign in' : 'Create your account', { index: false });
  const { account, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<AccountProblems | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [pending, setPending] = useState(false);
  const text = copy[mode];
  const state = location.state as { from?: string; signedOut?: boolean; email?: string } | null;
  // Filled in when they came from "Sign in instead" after finding their email already has an account.
  const [email, setEmail] = useState(state?.email ?? '');
  // A template chosen before signing up: kept for when they reach their ideas, and carried between sign-up and sign-in.
  const [params] = useSearchParams();
  const chosen = findTemplate(params.get('template') ?? undefined);
  useEffect(() => {
    if (chosen) {
      rememberTemplate(chosen.slug);
    }
  }, [chosen]);
  const validation = useInlineValidation({
    email: () => emailProblem(email),
    password: () =>
      mode === 'login'
        ? (password ? undefined : 'Enter your password.')
        : ((password ? undefined : 'Choose a password.') ?? (meetsPasswordRules(password) ? undefined : 'Your password doesn’t meet every rule yet.')),
  });
  const switchTo = chosen ? `${text.switchTo}?template=${chosen.slug}` : text.switchTo;

  // Someone who chose a template before signing up goes straight to their ideas, where it opens.
  const destination = state?.from ?? afterSignIn();

  if (account && !state?.signedOut) {
    return <Navigate to={destination} replace />;
  }

  if (registered) {
    return (
      <section className="card auth">
        <h1>Check your inbox</h1>
        <p>
          We sent a confirmation link to <strong>{email}</strong>. Open it to activate your account, then sign in.
        </p>
        {chosen && (
          <p className="note">
            Your <strong>{chosen.name}</strong> template will be ready when you sign in.
          </p>
        )}
        <p className="muted small">Nothing there? Check your spam folder, or send it again.</p>
        <ResendConfirmation email={email} />
        <p className="muted small">
          Confirmed already? <Link to={switchTo}>Sign in</Link>
        </p>
      </section>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validation.validate(event)) {
      return;
    }
    setPending(true);
    setError(null);
    setProblems(null);
    setNeedsConfirmation(false);
    try {
      if (mode === 'register') {
        await register(email, password);
        setRegistered(true);
        return;
      }
      await login(email, password);
      await navigate(destination, { replace: true });
    } catch (caught) {
      if (mode === 'register') {
        const found = readAccountProblems(caught);
        setProblems(found);
        setError(found.other ?? null);
        return;
      }
      setError(describe(caught, mode));
      setNeedsConfirmation(caught instanceof ApiError && caught.status === 401 && caught.message === notConfirmed);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-layout">
      <AuthAside />
      <section className="card auth">
      <img src="/logo.png" alt="" className="logo auth-logo" width="72" height="72" />
      <h1>{text.title}</h1>
      <p className="muted">Plan ideas, line up what they need, and never lose track of a date.</p>
      {chosen && (
        <p className="note">
          You’ll start with the <strong>{chosen.name}</strong> template once you’re in.
        </p>
      )}
      <form onSubmit={(event) => void submit(event)} className="stack" noValidate>
        <Field label="Email" error={validation.errors.email ?? problems?.email}>
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
        {problems?.duplicateEmail && (
          <p className="account-exists">
            <Link to="/login" state={{ email }}>
              Sign in instead
            </Link>
            <Link to="/forgot-password" state={{ email }}>
              Forgot your password?
            </Link>
          </p>
        )}
        <Field label="Password" hint={mode === 'register' ? <PasswordRules password={password} /> : undefined} error={validation.errors.password ?? problems?.password}>
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={validation.blur('password')}
            />
          )}
        </Field>
        {mode === 'login' && (
          <p className="field-after">
            <Link to="/forgot-password" state={{ email }}>
              Forgot your password?
            </Link>
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {needsConfirmation && <ResendConfirmation email={email} />}
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? 'Please wait…' : text.action}
        </button>
      </form>
      <p className="muted small">
        {text.switchText} <Link to={switchTo}>{text.switchLink}</Link>
      </p>
      </section>
    </div>
  );
}

/** The welcome panel beside the sign-in and sign-up forms on wide screens. */
function AuthAside() {
  return (
    <aside className="auth-aside" aria-label="About IdeaVerse">
      <div className="stack tight">
        <p className="eyebrow">IdeaVerse</p>
        <h2 className="section-title">Bright ideas deserve a plan.</h2>
      </div>
      <ul>
        <li>
          <Lightbulb aria-hidden="true" size={20} /> Capture ideas with a date to make them real
        </li>
        <li>
          <Puzzle aria-hidden="true" size={20} /> Line up everything they need
        </li>
        <li>
          <Users aria-hidden="true" size={20} /> Share the work with your team
        </li>
        <li>
          <AlarmClock aria-hidden="true" size={20} /> Get reminded before anything slips
        </li>
      </ul>
      <p className="small">Free to start. No credit card needed.</p>
    </aside>
  );
}
