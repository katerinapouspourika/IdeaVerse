import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { request } from '../api/client';
import { browserTimeZone } from '../api/dates';
import { currentZoneName, matchesZone, timeZoneOption, timeZoneOptions } from '../api/timeZones';
import type { Account, EmailFrequency, ReminderKind, ReminderSettings } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { readAccountProblems } from '../auth/identityErrors';
import { meetsPasswordRules, weakPasswordMessage } from '../auth/passwordRules';
import { PasswordRules } from '../auth/PasswordRules';
import { Field } from '../components/Field';
import { useInlineValidation } from '../components/useInlineValidation';
import { PasswordInput } from '../components/PasswordInput';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';
import { useConfirm } from '../components/Feedback';
import { usePageMeta } from '../seo/usePageMeta';

const reminderChoices: { kind: ReminderKind; label: string; hint: string }[] = [
  { kind: 'StartingSoon', label: 'Starting soon', hint: 'Before an idea’s start: 10, 5 and 2 days ahead, or closer on short notice, plus a nudge to add its components' },
  { kind: 'ComingUp', label: 'Coming up', hint: 'Two to seven days before the date' },
  { kind: 'Tomorrow', label: 'Due tomorrow', hint: 'The day before' },
  { kind: 'Today', label: 'Due today', hint: 'On the day' },
  { kind: 'Overdue', label: 'Overdue', hint: 'Once, when the date passes and it isn’t done' },
];

const frequencyChoices: { frequency: EmailFrequency; label: string; hint: string }[] = [
  { frequency: 'RightAway', label: 'Send right away', hint: 'Within a minute; several updates at once arrive as one email' },
  { frequency: 'DailyDigest', label: 'Daily digest', hint: 'One email a day at 8:00 in your time zone. Mentions are still emailed right away.' },
];

/** The signed-in user's own settings. The workspace's settings have their own page, linked from People. */
export function SettingsPage() {
  usePageMeta('Settings', { index: false });
  const { account } = useAuth();
  const sections = [
    { id: 'profile', label: 'Profile' },
    { id: 'email', label: 'Email' },
    { id: 'password', label: 'Password' },
    { id: 'time-zone', label: 'Time zone' },
    { id: 'reminders', label: 'Reminders' },
    { id: 'delete-account', label: 'Delete account' },
  ];

  return (
    <div className="stack">
      <h1>Settings</h1>
      <div className="settings-layout">
        {/* A sticky side menu on wide screens, and a list of jump links above the cards on phones. */}
        <nav className="settings-nav" aria-label="Settings sections">
          <ul>
            {sections.map((section) => (
              <li key={section.id}>
                <Link to={{ hash: section.id }}>{section.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="stack settings-sections">
          {account && <ProfileForm account={account} />}
          {account && <EmailForm account={account} />}
          <PasswordForm />
          <TimeZoneForm account={account} />
          {account && <RemindersForm account={account} />}
          <DeleteAccountForm />
        </div>
      </div>
    </div>
  );
}

/**
 * Saves a setting as soon as it changes, one save at a time in the order they were made. A save that fails puts back the
 * last value the API accepted and keeps its error to show; a later change clears it.
 */
function useInstantSave<T>(initial: T, save: (value: T) => Promise<void>) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<unknown>(null);
  const accepted = useRef(initial);
  const queue = useRef(Promise.resolve());
  const latest = useRef(0);

  const change = (next: T) => {
    const id = ++latest.current;
    setValue(next);
    setError(null);
    setState('saving');
    queue.current = queue.current.then(async () => {
      try {
        await save(next);
        accepted.current = next;
        if (id === latest.current) {
          setState('saved');
        }
      } catch (caught) {
        // Only the newest change reports back; an older failure is overtaken by the change made after it.
        if (id === latest.current) {
          setValue(accepted.current);
          setError(caught);
          setState('idle');
        }
      }
    });
  };

  return { value, state, error, change };
}

/** Says, beside a card's heading, whether its last change is being saved or has been. */
function SaveState({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  return (
    <span role="status" className={state === 'saved' ? 'save-state success' : 'save-state muted'}>
      {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : ''}
    </span>
  );
}

/** The time zone, saved as soon as one is picked; a search saves its first match once typing pauses. */
function TimeZoneForm({ account }: { account: Account | null }) {
  const { updateTimeZone } = useAuth();
  const saved = account?.timeZone ?? 'UTC';
  const zone = useInstantSave(saved, updateTimeZone);
  // A search shows its first match straight away, but saves it only once typing pauses.
  const [searched, setSearched] = useState<string | null>(null);
  const timeZone = searched ?? zone.value;
  const [search, setSearch] = useState('');
  const pause = useRef<ReturnType<typeof setTimeout>>(undefined);
  const detected = browserTimeZone();
  const options = useMemo(() => timeZoneOptions([saved]), [saved]);
  const matching = options.filter((option) => matchesZone(option, search));
  const selected = options.find((option) => option.id === timeZone) ?? timeZoneOption(timeZone);
  const shown = matching.some((option) => option.id === timeZone) ? matching : [selected, ...matching];
  const isDetected = currentZoneName(detected) === currentZoneName(timeZone);

  useEffect(() => () => clearTimeout(pause.current), []);

  const choose = (id: string) => {
    clearTimeout(pause.current);
    setSearched(null);
    if (id !== zone.value) {
      zone.change(id);
    }
  };

  const filter = (text: string) => {
    setSearch(text);
    const found = options.filter((option) => matchesZone(option, text));
    const first = found[0];
    if (first && !found.some((option) => option.id === timeZone)) {
      clearTimeout(pause.current);
      setSearched(first.id);
      pause.current = setTimeout(() => choose(first.id), searchPause);
    }
  };

  return (
    <form id="time-zone" className="card stack" onSubmit={(event) => event.preventDefault()} aria-label="Time zone">
      <div className="row spread">
        <h2>Time zone</h2>
        <SaveState state={zone.state} />
      </div>
      <Field label="Search time zones" hint="Type a city, region, or offset such as +02. The first match is chosen; pick another below.">
        {(props) => (
          <input {...props} type="search" autoComplete="off" value={search} onChange={(e) => filter(e.target.value)} placeholder="Athens" />
        )}
      </Field>
      <Field
        label="Your time zone"
        hint="Decides when an idea reaches its target date or is overdue for you. Reminders arrive at 8:00 in this time zone. Saved as soon as you pick one."
        error={fieldError(zone.error, 'timeZone')}
      >
        {(props) => (
          <select {...props} value={timeZone} onChange={(e) => choose(e.target.value)}>
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
          <button type="button" className="link-button" onClick={() => choose(currentZoneName(detected))}>
            Use it
          </button>
        </p>
      )}
      <ErrorMessage error={zone.error} />
    </form>
  );
}

/** How long a time zone search waits after the last keystroke before saving its first match. */
const searchPause = 800;

/** Which reminders to get and what is emailed; each switch saves as soon as it is flipped. */
function RemindersForm({ account }: { account: Account }) {
  const { updateReminders } = useAuth();
  const settings = useInstantSave<ReminderSettings>(
    {
      emailReminders: account.emailReminders,
      reminderKinds: account.reminderKinds,
      emailComments: account.emailComments,
      emailFrequency: account.emailFrequency,
    },
    updateReminders,
  );
  const { emailReminders: email, reminderKinds: kinds, emailComments: comments, emailFrequency: frequency } = settings.value;

  const toggle = (kind: ReminderKind, on: boolean) =>
    settings.change({ ...settings.value, reminderKinds: reminderChoices.map((c) => c.kind).filter((k) => (k === kind ? on : kinds.includes(k))) });

  return (
    <form id="reminders" className="card stack" onSubmit={(event) => event.preventDefault()} aria-label="Reminders">
      <div className="row spread">
        <h2>Reminders</h2>
        <SaveState state={settings.state} />
      </div>
      <p className="muted small">
        Reminders are for ideas you own or are on the team of. They always appear under the bell; choose which ones you get. Changes are saved straight away.
      </p>
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
        <input
          type="checkbox"
          checked={email}
          onChange={(e) => settings.change({ ...settings.value, emailReminders: e.target.checked, emailComments: e.target.checked && comments })}
        />
        <span>
          Email me about these
          <span className="muted small block">The reminders above, and being mentioned, assigned a component, or added to an idea’s team.</span>
        </span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={email && comments}
          disabled={!email}
          onChange={(e) => settings.change({ ...settings.value, emailComments: e.target.checked })}
        />
        <span>
          Email me about new comments too
          <span className="muted small block">Comments on ideas you own or are on the team of. Mentions are emailed either way.</span>
        </span>
      </label>
      <fieldset className="choices" disabled={!email}>
        <legend>When to email me</legend>
        {frequencyChoices.map((choice) => (
          <label key={choice.frequency} className="check">
            <input
              type="radio"
              name="email-frequency"
              checked={frequency === choice.frequency}
              onChange={() => settings.change({ ...settings.value, emailFrequency: choice.frequency })}
            />
            <span>
              {choice.label}
              <span className="muted small block">{choice.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {kinds.length === 0 && (
        <p className="muted small" role="note">
          With nothing ticked you won’t get any reminders.
        </p>
      )}
      <ErrorMessage error={settings.error} />
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

  /** Takes back the "saved" message, such as once the user edits what was saved. */
  const clearDone = () => setDone(false);

  return { error, pending, done, run, clearDone };
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
    <form id="profile" className="card stack" onSubmit={submit} aria-label="Profile">
      <h2>Profile</h2>
      <Field label="Your name" hint="Shown to your teams instead of your email address." error={fieldError(save.error, 'displayName')}>
        {(props) => (
          <input
            {...props}
            maxLength={100}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              save.clearDone();
            }}
            placeholder="e.g. Alex Morgan"
          />
        )}
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
    <form id="email" className="card stack" onSubmit={submit} aria-label="Email">
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
  const save = useSave();
  const problems = save.error ? readAccountProblems(save.error) : null;
  // Checked here first, so a weak new password is not reported as a wrong current one.
  const validation = useInlineValidation({
    oldPassword: () => (oldPassword ? undefined : 'Enter your current password.'),
    newPassword: () =>
      newPassword ? (meetsPasswordRules(newPassword) ? undefined : weakPasswordMessage) : 'Choose a new password.',
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!validation.validate(event)) {
      return;
    }
    void save.run(async () => {
      await request('POST', '/api/v1/auth/manage/info', { oldPassword, newPassword });
      setOldPassword('');
      setNewPassword('');
      validation.reset();
    });
  };

  return (
    <form id="password" className="card stack" onSubmit={submit} aria-label="Password" noValidate>
      <h2>Password</h2>
      <Field label="Current password" error={validation.errors.oldPassword ?? problems?.currentPassword}>
        {(props) => (
          <PasswordInput
            {...props}
            required
            autoComplete="current-password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            onBlur={validation.blur('oldPassword')}
          />
        )}
      </Field>
      <Field
        label="New password"
        hint={<PasswordRules password={newPassword} />}
        error={validation.errors.newPassword ?? problems?.password}
      >
        {(props) => (
          <PasswordInput
            {...props}
            required
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            onBlur={validation.blur('newPassword')}
          />
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
  const validation = useInlineValidation({ password: () => (password ? undefined : 'Enter your password to confirm.') });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validation.validate(event)) {
      return;
    }
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
    <form id="delete-account" className="card danger stack" onSubmit={(event) => void submit(event)} aria-label="Delete account" noValidate>
      <h2>Delete account</h2>
      <p className="muted small">
        Workspaces only you are in are deleted with everything in them. Ideas you own in other workspaces pass to each workspace’s owner.
        If you own a workspace other people use, hand it over from its workspace settings first.
      </p>
      <Field label="Password" error={validation.errors.password ?? fieldError(save.error, 'password')}>
        {(props) => (
          <PasswordInput
            {...props}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={validation.blur('password')}
          />
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
