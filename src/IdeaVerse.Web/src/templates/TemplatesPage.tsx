import { Link } from 'react-router';

import { cardGridClass } from '../components/cardGrid';
import { CtaBand } from '../components/CtaBand';
import { publicPages } from '../seo/pages';
import { usePageMeta } from '../seo/usePageMeta';
import { templates } from './templates';

/** The gallery of ready-made ideas to start from. */
export function TemplatesPage() {
  usePageMeta(publicPages['/templates'].title, { description: publicPages['/templates'].description });

  return (
    <div className="landing">
      <section className="landing-hero compact">
        <div className="landing-inner stack center">
          <p className="eyebrow">Templates</p>
          <h1 className="display">Start from a plan that already works</h1>
          <p className="lead">Each template fills in a new idea with a date and a checklist of everything it needs. Change anything to fit.</p>
        </div>
      </section>

      <section className="landing-section">
        <ul className={`landing-inner ${cardGridClass(templates.length)}`}>
          {templates.map((t) => (
            <li key={t.slug}>
              <Link to={`/templates/${t.slug}`} className="card stack template-card">
                <h2 className="small-title">{t.name}</h2>
                <p className="muted">{t.summary}</p>
                <span className="small template-meta">{t.components.length} things to plan · about {Math.round(t.days / 7)} weeks</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <CtaBand title="Ready to start from a plan?" text="Free to start. Pick a template once you’re in, or begin with a blank idea." />
    </div>
  );
}
