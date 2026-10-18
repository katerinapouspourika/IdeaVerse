import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { resetPassword } from '../api/account';
import { readAccountProblems, type AccountProblems } from '../auth/identityErrors';
import { meetsPasswordRules, weakPasswordMessage } from '../auth/passwordRules';
import { PasswordRules } from '../auth/PasswordRules';
import { Field } from '../components/Field';
import { PasswordInput } from '../components/PasswordInput';
import { usePageMeta } from '../seo/usePageMeta';

/** Opened from the password reset email; sets a new password with the link's code. */
export function ResetPasswordPage() {
  usePageMeta('Choose a new password', { index: false });
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const code = params.get('code') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [problems, setProblems] = useState<AccountProblems | null>(null);
  const [mismatch, setMismatch] = useState(false);

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
    setProblems(meetsPasswordRules(password) ? null : { duplicateEmail: false, expiredLink: false, password: weakPasswordMessage });
    setMismatch(password !== confirmation);
    if (password !== confirmation || !meetsPasswordRules(password)) {
      return;
    }
    setPending(true);
    try {
      await resetPassword(email, code, password);
      setDone(true);
    } catch (caught) {
      setProblems(readAccountProblems(caught));
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
        <Field label="New password" hint={<PasswordRules password={password} />} error={problems?.password}>
          {(props) => (
            <PasswordInput {...props} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <Field label="Repeat new password" error={mismatch ? 'The two passwords don’t match.' : undefined}>
          {(props) => (
            <PasswordInput {...props} autoComplete="new-password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          )}
        </Field>
        {problems?.expiredLink && (
          <p role="alert" className="error">
            This reset link has expired or was already used. <Link to="/forgot-password" state={{ email }}>Send a new link</Link>
          </p>
        )}
        {problems?.other && (
          <p role="alert" className="error">
            {problems.other}
          </p>
        )}
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </section>
  );
}
