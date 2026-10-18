import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import { publicPages } from '../seo/pages';
import { usePageMeta } from '../seo/usePageMeta';
import { faq } from './faq';

const included = [
  'Unlimited ideas, workspaces, and teammates',
  'List, board, calendar, timeline, and priority matrix views',
  'Components, assignments, due dates, and reminders by email',
  'Discussions with @mentions, votes, and impact × effort scoring',
  'AI help to brainstorm, plan, and improve ideas, where it’s switched on',
  'Works on phones, tablets, and computers, with nothing to download',
];

/** What IdeaVerse costs (nothing, during early access) and the questions people ask before signing up. */
export function PricingPage() {
  usePageMeta(publicPages['/pricing'].title, { description: publicPages['/pricing'].description });
  const { account } = useAuth();

  return (
    <div className="landing">
      <section className="landing-hero compact">
        <div className="landing-inner stack center">
          <p className="eyebrow">Pricing</p>
          <h1 className="display">Free while we’re in early access</h1>
          <p className="lead">Every feature, for your whole team, with no credit card needed.</p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-inner pricing">
          <article className="card stack pricing-plan" aria-labelledby="plan-name">
            <div className="stack tight">
              <p className="eyebrow">Early access</p>
              <h2 id="plan-name" className="section-title">
                Free
              </h2>
              <p className="muted">For teams of any size, while IdeaVerse is in early access.</p>
            </div>
            <ul className="check-steps">
              {included.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {account ? (
              <Link to="/ideas" className="button primary">
                Go to your ideas
              </Link>
            ) : (
              <Link to="/register" className="button primary">
                Get started free
              </Link>
            )}
          </article>
        </div>
      </section>

      <section className="landing-section tinted" aria-labelledby="faq-heading">
        <div className="landing-inner stack faq">
          <h2 id="faq-heading" className="section-title center-text">
            Questions
          </h2>
          {faq.map((item) => (
            <details key={item.question} className="card faq-item">
              <summary>
                {item.question}
                <ChevronDown aria-hidden="true" size={20} className="faq-chevron" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
          <p className="center-text muted">
            Something else? <Link to="/contact">Ask us</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
