import { Copy, Mail, MailCheck, MailX } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { ApiError } from '../api/client';
import { useContactStatus, useSendContactMessage } from '../api/queries';
import { useAuth } from '../auth/AuthContext';
import { Field } from '../components/Field';
import { fieldError } from '../components/ErrorMessage';
import { publicPages } from '../seo/pages';
import { usePageMeta } from '../seo/usePageMeta';

/** The public contact form; messages are emailed to the IdeaVerse team. */
export function ContactPage() {
  usePageMeta(publicPages['/contact'].title, { description: publicPages['/contact'].description });
  const { account } = useAuth();
  const send = useSendContactMessage();
  const status = useContactStatus();
  const directEmail = status.data?.email ?? null;
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [prefilled, setPrefilled] = useState(false);
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const thanks = useRef<HTMLHeadingElement>(null);

  // The form shows straight away (and is prerendered); a signed-in user's name and email fill in once the account loads.
  if (account && !prefilled) {
    setPrefilled(true);
    setName((current) => current || account.displayName || '');
    setEmail((current) => current || account.email);
  }

  // The form is replaced by the thank-you note, so move focus there for keyboard and screen reader users.
  useEffect(() => {
    if (send.isSuccess) {
      thanks.current?.focus();
    }
  }, [send.isSuccess]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setCopied(false);
    send.mutate({ name, email, message, website: website || undefined });
  };

  // A message that could not be sent stays in the form, ready to copy or to send by email instead.
  const failed = send.error && !(send.error instanceof ApiError && (send.error.status === 400 || send.error.status === 429));
  const mailto = directEmail
    ? `mailto:${directEmail}?subject=${encodeURIComponent(`Message from ${name || 'the IdeaVerse website'}`)}&body=${encodeURIComponent(message)}`
    : null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
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
          {status.data && !status.data.available ? (
            <div className="card stack center" role="status">
              <span className="feature-icon big" aria-hidden="true">
                <Mail size={36} />
              </span>
              <h2>Our contact form isn’t available right now</h2>
              {directEmail ? (
                <p>
                  Please email us at <a href={`mailto:${directEmail}`}>{directEmail}</a> instead. We’ll reply as soon as we can.
                </p>
              ) : (
                <p>Please try again a little later.</p>
              )}
            </div>
          ) : send.isSuccess ? (
            <div className="card stack center" role="status">
              <span className="feature-icon big" aria-hidden="true">
                <MailCheck size={36} />
              </span>
              <h2 ref={thanks} tabIndex={-1}>
                Thanks, your message is on its way!
              </h2>
              <p className="muted">We’ll get back to you at {email}.</p>
            </div>
          ) : (
            <form className="card stack" onSubmit={submit} aria-label="Contact us">
              <noscript>
                <p className="error">Sending a message needs JavaScript. Please turn it on and reload the page.</p>
              </noscript>
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
              {send.error instanceof ApiError && send.error.status === 429 && (
                <p role="alert" className="error">
                  You’ve sent a few messages already. Please try again in an hour.
                </p>
              )}
              {failed && (
                <div role="alert" className="contact-failed stack tight">
                  <p className="row">
                    <MailX aria-hidden="true" size={18} />
                    <strong>Your message wasn’t sent, but it’s still here.</strong>
                  </p>
                  <p className="small">Try again in a moment{mailto ? ', or send it to us by email.' : '.'}</p>
                  <div className="row wrap">
                    {mailto && (
                      <a href={mailto} className="button ghost small">
                        <Mail aria-hidden="true" size={16} /> Email it instead
                      </a>
                    )}
                    <button type="button" className="button ghost small" onClick={() => void copy()}>
                      <Copy aria-hidden="true" size={16} /> {copied ? 'Copied' : 'Copy message'}
                    </button>
                  </div>
                </div>
              )}
              <div className="row">
                <button type="submit" className="button primary" disabled={send.isPending}>
                  {send.isPending ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </form>
          )}
          {directEmail && status.data?.available && !send.isSuccess && (
            <p className="muted center-text contact-direct">
              Prefer email? Write to <a href={`mailto:${directEmail}`}>{directEmail}</a>.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
