import { Globe } from 'lucide-react';
import { useState } from 'react';

import { browserTimeZone } from '../api/dates';
import { currentZoneName, placeName } from '../api/timeZones';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Feedback';

/** Where this browser remembers the device time zone the user chose to keep their saved one for. */
const declinedKey = 'ideaverse.timeZonePrompt.declined';

function declinedZone(): string | null {
  try {
    return localStorage.getItem(declinedKey);
  } catch {
    return null;
  }
}

function rememberDeclined(zone: string) {
  try {
    localStorage.setItem(declinedKey, zone);
  } catch {
    // Storage blocked: the prompt shows again next time, which is harmless.
  }
}

/**
 * Offers to switch the account's time zone to the device's when they differ, such as while travelling. Nothing changes
 * unless the user agrees, since the time zone decides when their reminders arrive and when ideas are overdue. Keeping the
 * saved one is remembered for that device time zone, so the offer comes back only from somewhere else.
 */
export function TimeZonePrompt() {
  const { account, updateTimeZone } = useAuth();
  const toast = useToast();
  const device = currentZoneName(browserTimeZone());
  const [declined, setDeclined] = useState(declinedZone);
  const [pending, setPending] = useState(false);
  const saved = account?.timeZone;

  if (!saved || currentZoneName(saved) === device || declined === device) {
    return null;
  }

  const keep = () => {
    rememberDeclined(device);
    setDeclined(device);
  };

  const switchZone = async () => {
    setPending(true);
    try {
      await updateTimeZone(device);
      toast({ message: `Time zone set to ${placeName(device)}` });
    } catch {
      toast({ message: 'Couldn’t change your time zone. Try again in Settings.', tone: 'error' });
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="card row wrap time-zone-prompt" aria-label="Time zone">
      <Globe aria-hidden="true" size={20} />
      <p className="grow">
        You seem to be in <strong>{placeName(device)}</strong> time, but IdeaVerse is using <strong>{placeName(saved)}</strong>. Your
        reminders and due dates follow the time zone you choose.
      </p>
      <div className="row">
        <button type="button" className="button primary small" disabled={pending} onClick={() => void switchZone()}>
          Switch to {placeName(device)}
        </button>
        <button type="button" className="button ghost small" disabled={pending} onClick={keep}>
          Keep {placeName(saved)}
        </button>
      </div>
    </section>
  );
}
