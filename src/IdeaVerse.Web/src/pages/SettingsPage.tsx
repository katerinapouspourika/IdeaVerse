import { useState, type FormEvent } from 'react';

import { browserTimeZone } from '../api/dates';
import { useAuth } from '../auth/AuthContext';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';

/** Every IANA time zone the browser knows, with UTC, sorted by name. */
function timeZones(current: string): string[] {
  const known = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return [...new Set(['UTC', current, ...known])].sort((a, b) => a.localeCompare(b));
}

/** The signed-in user's settings: for now, their time zone. */
export function SettingsPage() {
  const { account, updateTimeZone } = useAuth();
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
    <div className="stack">
      <h1>Settings</h1>
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
    </div>
  );
}
