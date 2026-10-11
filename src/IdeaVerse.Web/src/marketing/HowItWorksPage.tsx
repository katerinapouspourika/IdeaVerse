import { Link } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import { walkthroughs } from './walkthroughs';

/** Short recorded walkthroughs of the real app, one per step of working with ideas. */
export function HowItWorksPage() {
  const { account } = useAuth();

  return (
    <div className="landing">
      <section className="landing-hero compact">
        <div className="landing-inner stack center">
          <p className="eyebrow">How it works</p>
          <h1 className="display">From spark to done, in four steps</h1>
          <p className="lead">Each clip is recorded straight from IdeaVerse, so what you see is exactly what you get.</p>
        </div>
      </section>

      <section className="landing-section">
        <ol className="landing-inner walkthroughs">
          {walkthroughs.map((w, i) => (
            <li key={w.slug} className="walkthrough">
              <div className="walkthrough-video">
                <video controls muted loop playsInline preload="metadata" poster={`/how-it-works/${w.slug}.png`} aria-label={`Video: ${w.title}`}>
                  <source src={`/how-it-works/${w.slug}.webm`} type="video/webm" />
                </video>
              </div>
              <div className="stack tight">
                <p className="eyebrow">Step {i + 1}</p>
                <h2 className="section-title small-title">{w.title}</h2>
                <p className="lead muted">{w.summary}</p>
                <ul className="check-steps">
                  {w.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-section">
        <div className="landing-inner">
          <div className="cta-band">
            <h2 className="section-title">{account ? 'Put it to work' : 'Try it with your own ideas'}</h2>
            <div className="row wrap center-row">
              <Link to={account ? '/ideas' : '/register'} className="button light large">
                {account ? 'Go to your ideas' : 'Get started free'}
              </Link>
              <Link to="/contact" className="button outline-light large">
                Questions? Contact us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
