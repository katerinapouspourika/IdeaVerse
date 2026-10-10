import { useState, type FormEvent } from 'react';

import { browserTimeZone } from '../api/dates';
import type { Account, ReminderKind } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';

/** Every IANA time zone the browser knows, with UTC, sorted by name. */
function timeZones(current: string): string[] {
  const known = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return [...new Set(['UTC', current, ...known])].sort((a, b) => a.localeCompare(b));
}

const reminderChoices: { kind: ReminderKind; label: string; hint: string }[] = [
  { kind: 'ComingUp', label: 'Coming up', hint: 'Two to seven days before the date' },
  { kind: 'Tomorrow', label: 'Due tomorrow', hint: 'The day before' },
  { kind: 'Today', label: 'Due today', hint: 'On the day' },
  { kind: 'Overdue', label: 'Overdue', hint: 'Once, when the date passes and it isn’t done' },
];

/** The signed-in user's settings: their time zone and reminders. */
export function SettingsPage() {
  const { account } = useAuth();

  return (
    <div className="stack">
      <h1>Settings</h1>
      <TimeZoneForm account={account} />
      {account && <RemindersForm account={account} />}
    </div>
  );
}

function TimeZoneForm({ account }: { account: Account | null }) {
  const { updateTimeZone } = useAuth();
  const saved = account?.timeZone ?? 'UTC';
  const [timeZone, setTimeZone] = useState(saved);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const detected = browserTimeZone();

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
      <Field
        label="Your time zone"
        hint="Decides when an idea is due today or overdue for you. Reminders arrive at 8:00 in this time zone."
        error={fieldError(error, 'timeZone')}
      >
        {(props) => (
          <select {...props} value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
            {timeZones(saved).map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        )}
      </Field>
      {detected !== timeZone && (
        <p className="small">
          This browser is set to {detected.replaceAll('_', ' ')}.{' '}
          <button type="button" className="link-button" onClick={() => setTimeZone(detected)}>
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
      await updateReminders({ emailReminders: email, reminderKinds: kinds });
      setDone(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="card stack" onSubmit={(event) => void submit(event)} aria-label="Reminders">
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
