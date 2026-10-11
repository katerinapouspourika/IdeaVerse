import { TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';

import { usePageMeta } from '../seo/usePageMeta';
import type { LegalDocument } from './legal';

/**
 * A legal document as a readable page with a contents list. It says plainly that it is a draft awaiting legal review,
 * and asks search engines not to index it until then.
 */
export function LegalPage({ document, description }: { document: LegalDocument; description: string }) {
  usePageMeta(document.title, { description, index: false });
  const id = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <div className="landing">
      <section className="landing-hero compact">
        <div className="landing-inner stack center">
          <p className="eyebrow">Legal</p>
          <h1 className="display">{document.title}</h1>
          <p className="muted">Last updated: {document.updated}</p>
        </div>
      </section>

      <section className="landing-section">
        <article className="landing-inner legal stack">
          <p className="legal-draft" role="note">
            <TriangleAlert aria-hidden="true" size={18} />
            <span>
              This is a draft and has not yet been reviewed by a lawyer. Details in [brackets] are still to be filled in. Questions?{' '}
              <Link to="/contact">Contact us</Link>.
            </span>
          </p>
          <p className="lead">{document.intro}</p>
          <nav aria-label="Contents" className="legal-contents">
            <ol>
              {document.sections.map((s) => (
                <li key={s.heading}>
                  <a href={`#${id(s.heading)}`}>{s.heading}</a>
                </li>
              ))}
            </ol>
          </nav>
          {document.sections.map((s) => (
            <section key={s.heading} aria-labelledby={id(s.heading)} className="stack tight">
              <h2 id={id(s.heading)}>{s.heading}</h2>
              {s.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {s.list && (
                <ul>
                  {s.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </section>
    </div>
  );
}
