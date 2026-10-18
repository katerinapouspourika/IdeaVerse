import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { request } from '../api/client';
import { browserTimeZone } from '../api/dates';
import { currentZoneName, matchesZone, timeZoneOption, timeZoneOptions } from '../api/timeZones';
import type { Account, ReminderKind, Workspace } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { readAccountProblems } from '../auth/identityErrors';
import { meetsPasswordRules, weakPasswordMessage } from '../auth/passwordRules';
import { PasswordRules } from '../auth/PasswordRules';
import { Field } from '../components/Field';
import { PasswordInput } from '../components/PasswordInput';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';
import { useConfirm } from '../components/Feedback';
import { usePageMeta } from '../seo/usePageMeta';
import { BrandingCard } from '../workspaces/BrandingCard';
import { canManageWorkspace, useWorkspace } from '../workspaces/WorkspaceContext';

const reminderChoices: { kind: ReminderKind; label: string; hint: string }[] = [
  { kind: 'StartingSoon', label: 'Starting soon', hint: 'Before an idea’s start: 10, 5 and 2 days ahead, or closer on short notice, plus a nudge to add its components' },
  { kind: 'ComingUp', label: 'Coming up', hint: 'Two to seven days before the date' },
  { kind: 'Tomorrow', label: 'Due tomorrow', hint: 'The day before' },
  { kind: 'Today', label: 'Due today', hint: 'On the day' },
  { kind: 'Overdue', label: 'Overdue', hint: 'Once, when the date passes and it isn’t done' },
];

/** The signed-in user's settings, and, for owners and admins, the current workspace's. */
export function SettingsPage() {
  usePageMeta('Settings', { index: false });
  const { account } = useAuth();
  const { current } = useWorkspace();

  return (
    <div className="stack">
      <h1>Settings</h1>
      {account && <ProfileForm account={account} />}
      <TimeZoneForm account={account} />
      {account && <RemindersForm account={account} />}
      {account && <EmailForm account={account} />}
      <PasswordForm />
      {current && canManageWorkspace(current) && <WorkspaceSettings key={current.id} workspace={current} />}
      <DeleteAccountForm />
    </div>
  );
}

/** The current workspace's settings, which apply to everyone in it; for its owners and admins. People links here as `#workspace`. */
function WorkspaceSettings({ workspace }: { workspace: Workspace }) {
  return (
    <section id="workspace" className="stack" aria-labelledby="workspace-settings-heading">
      <div className="stack tight">
        <h2 id="workspace-settings-heading">Workspace: {workspace.name}</h2>
        <p className="muted small">These apply to everyone in the workspace. Only its owners and admins see them.</p>
      </div>
      <BrandingCard workspace={workspace} />
    </section>
  );
}

function TimeZoneForm({ account }: { account: Account | null }) {
  const { updateTimeZone } = useAuth();
  const saved = account?.timeZone ?? 'UTC';
  const [timeZone, setTimeZone] = useState(saved);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [search, setSearch] = useState('');
  const detected = browserTimeZone();
  const options = useMemo(() => timeZoneOptions([saved]), [saved]);
  const matching = options.filter((option) => matchesZone(option, search));
  const selected = options.find((option) => option.id === timeZone) ?? timeZoneOption(timeZone);
  const shown = matching.some((option) => option.id === timeZone) ? matching : [selected, ...matching];
  const isDetected = currentZoneName(detected) === currentZoneName(timeZone);

  const filter = (text: string) => {
    setSearch(text);
    const found = options.filter((option) => matchesZone(option, text));
    const first = found[0];
    if (first && !found.some((option) => option.id === timeZone)) {
      setTimeZone(first.id);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setDone(false);
    try {
      await updateTimeZone(timeZone);
      setDone(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="card stack" onSubmit={(event) => void submit(event)} aria-label="Time zone">
      <h2>Time zone</h2>
      <Field label="Search time zones" hint="Type a city, region, or offset such as +02. The first match is chosen; pick another below.">
        {(props) => (
          <input {...props} type="search" autoComplete="off" value={search} onChange={(e) => filter(e.target.value)} placeholder="Athens" />
        )}
      </Field>
      <Field
        label="Your time zone"
        hint="Decides when an idea reaches its target date or is overdue for you. Reminders arrive at 8:00 in this time zone."
        error={fieldError(error, 'timeZone')}
      >
        {(props) => (
          <select {...props} value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
            {shown.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      {search.trim() !== '' && (
        <p role="status" className="muted small">
          {matching.length === 0
            ? `No time zone matches “${search.trim()}”.`
            : matching.length === 1
              ? '1 time zone matches.'
              : `${matching.length} time zones match.`}
        </p>
      )}
      {!isDetected && (
        <p className="small">
          This browser is set to {timeZoneOption(currentZoneName(detected)).label}.{' '}
          <button type="button" className="link-button" onClick={() => setTimeZone(currentZoneName(detected))}>
            Use it
          </button>
        </p>
      )}
      <ErrorMessage error={error} />
      {done && (
        <p role="status" className="success">
          Saved.
        </p>
      )}
      <div className="row">
        <button type="submit" className="button primary" disabled={pending || timeZone === saved}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function RemindersForm({ account }: { account: Account }) {
  const { updateReminders } = useAuth();
  const [email, setEmail] = useState(account.emailReminders);
  const [kinds, setKinds] = useState<ReminderKind[]>(account.reminderKinds);
  const [comments, setComments] = useState(account.emailComments);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const toggle = (kind: ReminderKind, on: boolean) =>
    setKinds((current) => reminderChoices.map((c) => c.kind).filter((k) => (k === kind ? on : current.includes(k))));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setDone(false);
    try {
      await updateReminders({ emailReminders: email, reminderKinds: kinds, emailComments: email && comments });
      setDone(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  };

  return (
    <form id="reminders" className="card stack" onSubmit={(event) => void submit(event)} aria-label="Reminders">
      <h2>Reminders</h2>
      <p className="muted small">Reminders are for ideas you own or are on the team of. They always appear under the bell; choose which ones you get.</p>
      <fieldset className="choices">
        <legend>Remind me when an idea is…</legend>
        {reminderChoices.map((choice) => (
          <label key={choice.kind} className="check">
            <input type="checkbox" checked={kinds.includes(choice.kind)} onChange={(e) => toggle(choice.kind, e.target.checked)} />
            <span>
              {choice.label}
              <span className="muted small block">{choice.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="check">
        <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
        <span>Also email me these reminders</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={email && comments} disabled={!email} onChange={(e) => setComments(e.target.checked)} />
        <span>
          Email me about new comments too
          <span className="muted small block">Comments on ideas you own or are on the team of. Mentions are always emailed.</span>
        </span>
      </label>
      {kinds.length === 0 && (
        <p className="muted small" role="note">
          With nothing ticked you won’t get any reminders.
        </p>
      )}
      <ErrorMessage error={error} />
      {done && (
        <p role="status" className="success">
          Saved.
        </p>
      )}
      <div className="row">
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

/** Runs a settings form's save, tracking whether it is pending, done, or failed. */
function useSave() {
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const run = async (save: () => Promise<void>) => {
    setPending(true);
    setError(null);
    setDone(false);
    try {
      await save();
      setDone(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  };

  return { error, pending, done, run };
}

function ProfileForm({ account }: { account: Account }) {
  const { updateDisplayName } = useAuth();
  const [name, setName] = useState(account.displayName ?? '');
  const save = useSave();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save.run(() => updateDisplayName(name));
  };

  return (
    <form className="card stack" onSubmit={submit} aria-label="Profile">
      <h2>Profile</h2>
      <Field label="Your name" hint="Shown to your teams instead of your email address." error={fieldError(save.error, 'displayName')}>
        {(props) => <input {...props} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Morgan" />}
      </Field>
      <ErrorMessage error={save.error} />
      {save.done && (
        <p role="status" className="success">
          Saved.
        </p>
      )}
      <div className="row">
        <button type="submit" className="button primary" disabled={save.pending}>
          Save
        </button>
      </div>
    </form>
  );
}

function EmailForm({ account }: { account: Account }) {
  const [newEmail, setNewEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const save = useSave();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const address = newEmail.trim();
    void save.run(async () => {
      await request('POST', '/api/v1/auth/manage/info', { newEmail: address });
      setSentTo(address);
      setNewEmail('');
    });
  };

  return (
    <form className="card stack" onSubmit={submit} aria-label="Email">
      <h2>Email</h2>
      <p className="muted small">
        You sign in with <strong>{account.email}</strong>. To change it, enter the new address; it changes once you open the link we send there.
      </p>
      <Field label="New email">
        {(props) => <input {...props} type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />}
      </Field>
      <ErrorMessage error={save.error} includeFieldErrors />
      {save.done && sentTo && (
        <p role="status" className="success">
          Check {sentTo} for a link to confirm the change.
        </p>
      )}
      <div className="row">
        <button type="submit" className="button primary" disabled={save.pending}>
          Send confirmation link
        </button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [weak, setWeak] = useState(false);
  const save = useSave();
  const problems = save.error ? readAccountProblems(save.error) : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Checked here first, so a weak new password is not reported as a wrong current one.
    setWeak(!meetsPasswordRules(newPassword));
    if (!meetsPasswordRules(newPassword)) {
      return;
    }
    void save.run(async () => {
      await request('POST', '/api/v1/auth/manage/info', { oldPassword, newPassword });
      setOldPassword('');
      setNewPassword('');
    });
  };

  return (
    <form className="card stack" onSubmit={submit} aria-label="Password">
      <h2>Password</h2>
      <Field label="Current password" error={problems?.currentPassword}>
        {(props) => (
          <PasswordInput {...props} required autoComplete="current-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
        )}
      </Field>
      <Field
        label="New password"
        hint={<PasswordRules password={newPassword} />}
        error={weak ? weakPasswordMessage : problems?.password}
      >
        {(props) => (
          <PasswordInput {...props} required autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        )}
      </Field>
      {problems?.other && (
        <p role="alert" className="error">
          {problems.other}
        </p>
      )}
      {save.done && (
        <p role="status" className="success">
          Password changed.
        </p>
      )}
      <div className="row">
        <button type="submit" className="button primary" disabled={save.pending}>
          Change password
        </button>
      </div>
    </form>
  );
}

function DeleteAccountForm() {
  const { deleteAccount } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const save = useSave();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await confirm({
      title: 'Delete your IdeaVerse account?',
      message: 'Your account and the workspaces only you are in are deleted for good. This cannot be undone.',
      confirmLabel: 'Delete account',
      danger: true,
    });
    if (!ok) {
      return;
    }
    void save.run(async () => {
      await deleteAccount(password);
      await navigate('/login');
    });
  };

  return (
    <form className="card danger stack" onSubmit={(event) => void submit(event)} aria-label="Delete account">
      <h2>Delete account</h2>
      <p className="muted small">
        Workspaces only you are in are deleted with everything in them. Ideas you own in other workspaces pass to each workspace’s owner.
        If you own a workspace other people use, hand it over from its People page first.
      </p>
      <Field label="Password" error={fieldError(save.error, 'password')}>
        {(props) => (
          <PasswordInput {...props} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
      </Field>
      <ErrorMessage error={save.error} />
      <div className="row">
        <button type="submit" className="button danger" disabled={save.pending}>
          Delete my account
        </button>
      </div>
    </form>
  );
}
