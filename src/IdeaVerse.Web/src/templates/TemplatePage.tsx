import { ArrowLeft, Square } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import { Progress } from '../components/Progress';
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

  return (
    <div className="landing">
      <section className="landing-hero compact">
        <div className="landing-inner stack center">
          <p className="eyebrow">Template</p>
          <h1 className="display">{template.name}</h1>
          <p className="lead">{template.summary}</p>
          <UseTemplateButton template={template} visitorLabel="Get started free" />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-inner template-detail stack">
          <nav aria-label="Breadcrumb" className="breadcrumb small">
            <Link to="/templates">
              <ArrowLeft aria-hidden="true" size={16} /> All templates
            </Link>
          </nav>
          <TemplatePreview template={template} />
          <div className="card stack">
            <h2 className="section-title small-title">What’s included</h2>
            <p className="muted">
              <strong>Best for:</strong> {template.forWho}
            </p>
            <ol className="template-steps" aria-label="What’s included">
              {template.components.map((c) => (
                <li key={c.title}>
                  <strong>{c.title}</strong>
                  {c.notes && <span className="muted small block">{c.notes}</span>}
                </li>
              ))}
            </ol>
            <p className="small muted">
              Target date about {Math.round(template.days / 7)} weeks away by default. Tags: {template.tags.join(', ')}. Everything can be changed once it’s yours.
            </p>
            <p>
              <UseTemplateButton template={template} visitorLabel="Use this template — free" />
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Starts an idea from the template: signed in, the New idea form opens with it; otherwise sign-up, with the template
 * remembered for when they reach their ideas.
 */
function UseTemplateButton({ template, visitorLabel }: { template: IdeaTemplate; visitorLabel: string }) {
  const { account } = useAuth();
  const navigate = useNavigate();
  return account ? (
    <button
      type="button"
      className="button primary"
      onClick={() => {
        // Also remembered, in case they still need to create a workspace before the form can open.
        rememberTemplate(template.slug);
        void navigate('/ideas', { state: { adding: true, template: template.slug } });
      }}
    >
      Use this template
    </button>
  ) : (
    <Link to={`/register?template=${template.slug}`} className="button primary" onClick={() => rememberTemplate(template.slug)}>
      {visitorLabel}
    </Link>
  );
}

/** How many checklist items the preview shows before "and N more". */
const previewItems = 3;

/** A small mock-up of the idea the template creates, built from the app's own styles. */
function TemplatePreview({ template }: { template: IdeaTemplate }) {
  const total = template.components.length;
  const more = total - previewItems;
  return (
    <figure className="template-preview-card" aria-label={`How a ${template.name.toLowerCase()} idea looks once created`}>
      <figcaption className="eyebrow">Once created</figcaption>
      <div className="preview-card">
        <div className="row spread">
          <strong>{template.title}</strong>
          <span className="badge">Planned</span>
        </div>
        <div className="row spread wrap small">
          <span className="muted">Target date in {Math.round(template.days / 7)} weeks</span>
          <Progress done={0} total={total} />
        </div>
        <ul className="tags" aria-label="Tags">
          {template.tags.map((tag) => (
            <li key={tag} className="tag">
              {tag}
            </li>
          ))}
        </ul>
        <ul className="preview-checklist" aria-label="Checklist">
          {template.components.slice(0, previewItems).map((c) => (
            <li key={c.title}>
              <Square aria-hidden="true" size={16} />
              {c.title}
              <span className="visually-hidden"> (not done yet)</span>
            </li>
          ))}
          {more > 0 && <li className="muted small">and {more} more</li>}
        </ul>
      </div>
    </figure>
  );
}
