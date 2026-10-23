import { ArrowLeft, Check } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import { cardGridClass } from '../components/cardGrid';
import { CtaBand } from '../components/CtaBand';
import { NotFoundPage } from '../pages/NotFoundPage';
import { publicPages } from '../seo/pages';
import { usePageMeta } from '../seo/usePageMeta';
import { findTemplate } from '../templates/templates';
import { comparisons, useCases, type Comparison, type UseCase } from './content';

/** The button at the end of each page: sign up, or go to the app when already signed in. */
function StartButton() {
  const { account } = useAuth();
  return account ? (
    <Link to="/ideas" className="button primary">
      Go to your ideas
    </Link>
  ) : (
    <Link to="/register" className="button primary">
      Get started free
    </Link>
  );
}

function Hero({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return (
    <section className="landing-hero compact">
      <div className="landing-inner stack center">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display">{title}</h1>
        <p className="lead">{lead}</p>
      </div>
    </section>
  );
}

/** The list of use cases. */
export function UseCasesPage() {
  usePageMeta(publicPages['/use-cases'].title, { description: publicPages['/use-cases'].description });
  return (
    <div className="landing">
      <Hero eyebrow="Use cases" title="Made for teams with more ideas than time" lead="Built for marketing teams planning campaigns, content, and launches. See how other teams make it their own too." />
      <section className="landing-section">
        <ul className={`landing-inner ${cardGridClass(useCases.length)}`}>
          {useCases.map((u) => (
            <li key={u.slug}>
              <Link to={`/use-cases/${u.slug}`} className="card stack template-card">
                <h2 className="small-title">{u.audience}</h2>
                <p className="muted">{u.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <CtaBand title="Ready to plan your team’s ideas?" text="Free to start. Invite your team whenever you’re ready." />
    </div>
  );
}

/** One use case, by its slug. */
export function UseCasePage() {
  const { slug } = useParams();
  const useCase = useCases.find((u) => u.slug === slug);
  return useCase ? <UseCaseDetail useCase={useCase} /> : <NotFoundPage />;
}

function UseCaseDetail({ useCase }: { useCase: UseCase }) {
  usePageMeta(`IdeaVerse for ${useCase.audience.toLowerCase()}`, { description: useCase.summary });
  const suggested = useCase.templates.map((s) => findTemplate(s)).filter((t) => t !== undefined);

  return (
    <div className="landing">
      <Hero eyebrow={useCase.audience} title={useCase.headline} lead={useCase.summary} />
      <section className="landing-section">
        <div className="landing-inner stack">
          <nav aria-label="Breadcrumb" className="breadcrumb small">
            <Link to="/use-cases">
              <ArrowLeft aria-hidden="true" size={16} /> All use cases
            </Link>
          </nav>
          <section className="card stack" aria-labelledby="problems-heading">
            <h2 id="problems-heading" className="small-title">
              Sound familiar?
            </h2>
            <ul className="solution-problems">
              {useCase.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="helps-heading" className="stack">
            <h2 id="helps-heading" className="section-title">
              How IdeaVerse helps
            </h2>
            <div className={cardGridClass(useCase.helps.length)}>
              {useCase.helps.map((h) => (
                <div key={h.title} className="card stack tight">
                  <h3>{h.title}</h3>
                  <p className="muted">{h.text}</p>
                </div>
              ))}
            </div>
          </section>
          {suggested.length > 0 && (
            <section aria-labelledby="templates-heading" className="stack">
              <h2 id="templates-heading" className="section-title">
                Templates to start with
              </h2>
              <ul className={cardGridClass(suggested.length)}>
                {suggested.map((t) => (
                  <li key={t.slug}>
                    <Link to={`/templates/${t.slug}`} className="card stack template-card">
                      <h3 className="small-title">{t.name}</h3>
                      <p className="muted">{t.summary}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="center-text">
            <StartButton />
          </div>
        </div>
      </section>
    </div>
  );
}

/** The list of comparisons. */
export function ComparisonsPage() {
  usePageMeta(publicPages['/compare'].title, { description: publicPages['/compare'].description });
  return (
    <div className="landing">
      <Hero eyebrow="Compare" title="Is IdeaVerse the right fit?" lead="An honest look at how IdeaVerse compares with other ways teams plan their ideas, including when they’re the better choice." />
      <section className="landing-section">
        <ul className={`landing-inner ${cardGridClass(comparisons.length)}`}>
          {comparisons.map((c) => (
            <li key={c.slug}>
              <Link to={`/compare/${c.slug}`} className="card stack template-card">
                <h2 className="small-title">IdeaVerse vs {c.alternative}</h2>
                <p className="muted">{c.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <CtaBand title="Ready to see if it fits?" text="Free to start, so the quickest way to know is to try it with one real idea." />
    </div>
  );
}

/** One comparison, by its slug. */
export function ComparisonPage() {
  const { slug } = useParams();
  const comparison = comparisons.find((c) => c.slug === slug);
  return comparison ? <ComparisonDetail comparison={comparison} /> : <NotFoundPage />;
}

function ComparisonDetail({ comparison }: { comparison: Comparison }) {
  usePageMeta(`IdeaVerse vs ${comparison.alternative}`, { description: comparison.summary });
  const alternative = comparison.alternative.replace(/^an? /, '');
  const capitalised = alternative.charAt(0).toUpperCase() + alternative.slice(1);

  return (
    <div className="landing">
      <Hero eyebrow="Compare" title={comparison.headline} lead={comparison.summary} />
      <section className="landing-section">
        <div className="landing-inner stack">
          <nav aria-label="Breadcrumb" className="breadcrumb small">
            <Link to="/compare">
              <ArrowLeft aria-hidden="true" size={16} /> All comparisons
            </Link>
          </nav>
          <div className="card table-scroll">
            <table className="comparison">
              <caption className="visually-hidden">
                IdeaVerse compared with {comparison.alternative}
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="visually-hidden">Topic</span>
                  </th>
                  <th scope="col">{capitalised}</th>
                  <th scope="col">IdeaVerse</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((r) => (
                  <tr key={r.topic}>
                    <th scope="row">{r.topic}</th>
                    <td data-label={capitalised}>{r.alternative}</td>
                    <td data-label="IdeaVerse">
                      <Check aria-hidden="true" size={16} className="comparison-check" /> {r.ideaverse}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section className="card stack" aria-labelledby="good-for-heading">
            <h2 id="good-for-heading" className="small-title">
              When {comparison.alternative} is the better choice
            </h2>
            <ul className="solution-problems">
              {comparison.goodFor.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </section>
          <p className="lead center-text">{comparison.verdict}</p>
          <div className="center-text">
            <StartButton />
          </div>
        </div>
      </section>
    </div>
  );
}
