import { Link } from 'react-router';

const features = [
  { icon: '💡', title: 'Capture every idea', text: 'Give each idea a title, a description, tags, and a date to make it real by.' },
  { icon: '🧩', title: 'Plan what it needs', text: 'Break ideas into components and tick them off. Progress shows at a glance.' },
  { icon: '👥', title: 'Work as a team', text: 'Shared workspaces, idea teams, comments, and tasks with owners and due dates.' },
  { icon: '⏰', title: 'Never miss a date', text: 'Reminders a week before, the day before, and on the day — in your own time zone.' },
  { icon: '🗓️', title: 'See the big picture', text: 'Search, filter by tag, and switch to a month calendar of everything that’s coming.' },
  { icon: '✨', title: 'AI help when you want it', text: 'Brainstorm new ideas, suggest what an idea needs, and sharpen how it’s written.' },
];

const steps = [
  { title: 'Create a workspace', text: 'For your company, your team, or just you.' },
  { title: 'Add ideas with dates', text: 'Capture them the moment they strike.' },
  { title: 'Plan, share, and finish', text: 'Line up what they need and bring them to life — on time.' },
];

/** The public home page for visitors who are not signed in. */
export function LandingPage() {
  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="landing-inner hero-grid">
          <div className="stack">
            <p className="eyebrow">Idea planning for teams</p>
            <h1 className="display">
              Turn bright ideas into <span className="highlight">done</span> ideas.
            </h1>
            <p className="lead">
              IdeaVerse is where your team captures ideas, plans what each one needs, and gets reminded before dates slip.
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
          <HeroPreview />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-inner stack">
          <div className="section-heading">
            <h2 className="section-title">Everything an idea needs to happen</h2>
            <p className="lead muted">Simple enough for one person, organised enough for the whole company.</p>
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
            <h2 className="section-title">Up and running in minutes</h2>
          </div>
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={s.title} className="step">
                <span className="step-number" aria-hidden="true">
                  {i + 1}
                </span>
                <h3>{s.title}</h3>
                <p className="muted">{s.text}</p>
              </li>
            ))}
          </ol>
          <p className="center">
            <Link to="/how-it-works" className="button">
              Watch the walkthroughs →
            </Link>
          </p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-inner">
          <div className="cta-band">
            <h2 className="section-title">Ready to make your next idea happen?</h2>
            <p className="lead">Free to start. Invite your team whenever you’re ready.</p>
            <div className="row wrap center-row">
              <Link to="/register" className="button light large">
                Create your account
              </Link>
              <Link to="/contact" className="button outline-light large">
                Talk to us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** A decorative mock-up of the ideas list, built from the app's own styles. */
function HeroPreview() {
  return (
    <div className="hero-preview" aria-hidden="true">
      <div className="preview-card">
        <div className="row spread">
          <strong>Spring product launch</strong>
          <span className="badge">In progress</span>
        </div>
        <div className="row spread small">
          <span className="muted">Due in 6 days</span>
          <span className="progress-track">
            <span className="progress-fill" style={{ width: '70%' }} />
          </span>
        </div>
        <ul className="tags">
          <li className="tag">marketing</li>
          <li className="tag">q2</li>
        </ul>
      </div>
      <div className="preview-card offset">
        <div className="row spread">
          <strong>Team offsite</strong>
          <span className="badge status-postponed">Postponed</span>
        </div>
        <div className="row spread small">
          <span className="muted">Due in 3 weeks</span>
          <span className="progress-track">
            <span className="progress-fill" style={{ width: '35%' }} />
          </span>
        </div>
      </div>
      <div className="preview-card">
        <div className="row spread">
          <strong>Customer newsletter</strong>
          <span className="badge status-done">Done</span>
        </div>
        <div className="row spread small">
          <span className="muted">Finished on time 🎉</span>
          <span className="progress-track">
            <span className="progress-fill" style={{ width: '100%' }} />
          </span>
        </div>
      </div>
      <img src="/logo.png" alt="" className="preview-logo" width="64" height="64" />
    </div>
  );
}
