import { useState } from 'react';

import { resendConfirmation } from '../api/account';

/** A button that sends the confirmation email again and says when it has. */
export function ResendConfirmation({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const send = async () => {
    setState('sending');
    try {
      await resendConfirmation(email);
      setState('sent');
    } catch {
      setState('failed');
    }
  };

  if (state === 'sent') {
    return <p role="status">We sent a new confirmation link to {email}.</p>;
  }

  return (
    <div className="row wrap">
      <button type="button" className="button" onClick={() => void send()} disabled={state === 'sending' || !email}>
        {state === 'sending' ? 'Sending…' : 'Send the link again'}
      </button>
      {state === 'failed' && (
        <span role="alert" className="error">
          Couldn’t send it. Please try again.
        </span>
      )}
    </div>
  );
}
