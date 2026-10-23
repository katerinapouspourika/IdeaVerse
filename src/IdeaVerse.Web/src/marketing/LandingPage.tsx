import { AlarmClock, ArrowRight, Lightbulb, Puzzle, Sparkles, Target, Users } from 'lucide-react';
import { Link } from 'react-router';

import { CtaBand } from '../components/CtaBand';
import { publicPages } from '../seo/pages';
import { usePageMeta } from '../seo/usePageMeta';
import { HeroClip } from './HeroClip';
import { walkthroughs } from './walkthroughs';

const features = [
  { icon: <Lightbulb size={24} />, title: 'Capture every idea', text: 'Keep campaign, content, and launch ideas together, with tags and a target date.' },
  { icon: <Puzzle size={24} />, title: 'Plan what it needs', text: 'List the brief, copy, creative, approvals, and tracking each idea needs. Tick them off as they’re ready.' },
  { icon: <Users size={24} />, title: 'Work as a team', text: 'Give each piece of work an owner and a due date, and keep feedback in the idea’s discussion.' },
  {
    icon: <Target size={24} />,
    title: 'Decide what’s worth doing',
    text: 'Vote for the ideas you back, score impact and effort, and spot the quick wins on the priority matrix.',
  },
  {
    icon: <AlarmClock size={24} />,
    title: 'Never miss a date',
    text: 'A calendar of everything coming, and reminders a week before, the day before, and on the day — in your own time zone.',
  },
  { icon: <Sparkles size={24} />, title: 'AI help when you want it', text: 'Brainstorm campaign ideas, suggest what they need, and sharpen the audience, goal, and success measure. You choose what to keep.' },
];

/** Short promises under the hero; each must stay true to the pricing page, the FAQ, and the Privacy Policy and Terms. */
const trust = ['Free in early access', 'No credit card needed', 'Your data is never sold', 'Delete your account any time'];

/** The public home page for visitors who are not signed in. */
export function LandingPage() {
  usePageMeta(publicPages['/'].title, { description: publicPages['/'].description });
  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="landing-inner hero-grid">
          <div className="stack">
            <p className="eyebrow">Idea planning for marketing teams</p>
            <h1 className="display">
              Turn campaign ideas into <span className="highlight">action</span>.
            </h1>
            <p className="lead">
              Give your marketing team one place to capture ideas, decide what to run, and plan the work before launch dates slip.
            </p>
            <div className="row wrap">
              <Link to="/register" className="button primary large">
                Get started free
              </Link>
              <Link to="/how-it-works" className="button large">
                See how it works
              </Link>
            </div>
          </div>
          <HeroClip />
        </div>
      </section>

      <section className="trust-strip" aria-label="The small print, up front">
        <ul className="landing-inner">
          {trust.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="landing-section">
        <div className="landing-inner stack">
          <div className="section-heading">
            <h2 className="section-title">Everything an idea needs to happen</h2>
            <p className="lead muted">Built around campaigns, content, and launches. Flexible enough for any team’s ideas.</p>
          </div>
          <ul className="feature-grid">
            {features.map((f) => (
              <li key={f.title} className="feature">
                <span className="feature-icon" aria-hidden="true">
                  {f.icon}
                </span>
                <h3>{f.title}</h3>
                <p className="muted">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing-section tinted">
        <div className="landing-inner stack">
          <div className="section-heading">
            <h2 className="section-title">Four steps from spark to done</h2>
          </div>
          <ol className="steps">
            {walkthroughs.map((w, i) => (
              <li key={w.slug} className="step">
                <span className="step-number" aria-hidden="true">
                  {i + 1}
                </span>
                <h3>{w.title}</h3>
                <p className="muted">{w.summary}</p>
              </li>
            ))}
          </ol>
          <p className="center">
            <Link to="/how-it-works" className="button">
              Watch the walkthroughs <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </p>
        </div>
      </section>

      <CtaBand title="Ready to plan your next campaign?" text="Start with an idea or a marketing template. Free during early access, with no credit card needed." />
    </div>
  );
}
