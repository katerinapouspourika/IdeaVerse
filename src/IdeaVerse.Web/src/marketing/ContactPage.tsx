import { useEffect, useRef, useState, type FormEvent } from 'react';

import { ApiError } from '../api/client';
import { useSendContactMessage } from '../api/queries';
import { useAuth } from '../auth/AuthContext';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';

/** The public contact form; messages are emailed to the IdeaVerse team. */
export function ContactPage() {
  const { account, isLoading } = useAuth();

  if (isLoading) {
    return <p className="muted">Loading…</p>;
  }

  return <ContactForm name={account?.displayName ?? ''} email={account?.email ?? ''} />;
}

function ContactForm(initial: { name: string; email: string }) {
  const send = useSendContactMessage();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const thanks = useRef<HTMLHeadingElement>(null);

  // The form is replaced by the thank-you note, so move focus there for keyboard and screen reader users.
  useEffect(() => {
    if (send.isSuccess) {
      thanks.current?.focus();
    }
  }, [send.isSuccess]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send.mutate({ name, email, message, website: website || undefined });
  };

  return (
    <div className="landing">
      <section className="landing-hero compact">
        <div className="landing-inner stack center">
          <p className="eyebrow">Contact us</p>
          <h1 className="display">We’d love to hear from you</h1>
          <p className="lead">Questions, feedback, or ideas for IdeaVerse itself — send us a message and we’ll reply by email.</p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-inner contact-inner">
          {send.isSuccess ? (
            <div className="card stack center" role="status">
              <span className="feature-icon big" aria-hidden="true">
                💌
              </span>
              <h2 ref={thanks} tabIndex={-1}>
                Thanks, your message is on its way!
              </h2>
              <p className="muted">We’ll get back to you at {email}.</p>
            </div>
          ) : (
            <form className="card stack" onSubmit={submit} aria-label="Contact us">
              <div className="row wrap">
                <Field label="Your name" className="grow" error={fieldError(send.error, 'name')}>
                  {(props) => <input {...props} required maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
                </Field>
                <Field label="Email" className="grow" error={fieldError(send.error, 'email')}>
                  {(props) => (
                    <input {...props} type="email" required maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  )}
                </Field>
              </div>
              <Field label="Message" error={fieldError(send.error, 'message')}>
                {(props) => (
                  <textarea {...props} required rows={6} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} />
                )}
              </Field>
              <div className="visually-hidden" aria-hidden="true">
                <label htmlFor="contact-website">Website</label>
                <input id="contact-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              {send.error instanceof ApiError && send.error.status === 429 ? (
                <p role="alert" className="error">
                  You’ve sent a few messages already. Please try again in an hour.
                </p>
              ) : (
                <ErrorMessage error={send.error} />
              )}
              <div className="row">
                <button type="submit" className="button primary" disabled={send.isPending}>
                  {send.isPending ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
