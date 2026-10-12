import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import { NotFoundPage } from '../pages/NotFoundPage';
import { usePageMeta } from '../seo/usePageMeta';
import { rememberTemplate } from './pendingTemplate';
import { findTemplate, type IdeaTemplate } from './templates';

/** One template: what it includes, and a way to start an idea from it. */
export function TemplatePage() {
  const { slug } = useParams();
  const template = findTemplate(slug);
  return template ? <TemplateDetail template={template} /> : <NotFoundPage />;
}

function TemplateDetail({ template }: { template: IdeaTemplate }) {
  usePageMeta(`${template.name} template`, { description: template.summary });
  const { account } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="landing">
      <section className="landing-hero compact">
        <div className="landing-inner stack center">
          <p className="eyebrow">Template</p>
          <h1 className="display">{template.name}</h1>
          <p className="lead">{template.summary}</p>
          {account ? (
            <button type="button" className="button primary" onClick={() => {
                // Also remembered, in case they still need to create a workspace before the form can open.
                rememberTemplate(template.slug);
                void navigate('/ideas', { state: { adding: true, template: template.slug } });
              }}>
              Use this template
            </button>
          ) : (
            <Link to={`/register?template=${template.slug}`} className="button primary" onClick={() => rememberTemplate(template.slug)}>
              Get started free
            </Link>
          )}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-inner template-detail">
          <nav aria-label="Breadcrumb" className="breadcrumb small">
            <Link to="/templates">
              <ArrowLeft aria-hidden="true" size={16} /> All templates
            </Link>
          </nav>
          <div className="card stack">
            <h2 className="section-title small-title">What it plans for</h2>
            <p className="muted">{template.forWho}</p>
            <ol className="template-steps">
              {template.components.map((c) => (
                <li key={c.title}>
                  <strong>{c.title}</strong>
                  {c.notes && <span className="muted small block">{c.notes}</span>}
                </li>
              ))}
            </ol>
            <p className="small muted">
              Due in about {Math.round(template.days / 7)} weeks by default. Tags: {template.tags.join(', ')}. Everything can be changed once it’s yours.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
