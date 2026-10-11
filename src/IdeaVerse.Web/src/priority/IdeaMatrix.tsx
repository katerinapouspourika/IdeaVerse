import { Link } from 'react-router';

import type { Idea } from '../api/types';
import { quadrantHints, quadrantLabels, quadrantOf, quadrants, type Quadrant } from './priority';

/** Places scored ideas on a 2×2 of impact against effort, with the ideas still to score listed below. */
export function IdeaMatrix({ ideas }: { ideas: Idea[] }) {
  const placed = new Map<Quadrant, Idea[]>(quadrants.map((q) => [q, []]));
  const unscored: Idea[] = [];
  for (const idea of ideas) {
    const quadrant = quadrantOf(idea);
    if (quadrant) {
      placed.get(quadrant)!.push(idea);
    } else {
      unscored.push(idea);
    }
  }

  return (
    <div className="stack">
      <div className="matrix" role="group" aria-label="Impact and effort matrix">
        <span className="matrix-axis impact" aria-hidden="true">
          Impact ↑
        </span>
        <span className="matrix-axis effort" aria-hidden="true">
          Effort →
        </span>
        {quadrants.map((q) => (
          <section key={q} className={`card stack tight matrix-cell ${q}`} aria-labelledby={`matrix-${q}`}>
            <h2 id={`matrix-${q}`}>
              {quadrantLabels[q]} <span className="count muted">{placed.get(q)!.length}</span>
            </h2>
            <p className="muted small">{quadrantHints[q]}</p>
            <ul className="matrix-ideas">
              {placed.get(q)!.map((idea) => (
                <li key={idea.id}>
                  <Link to={`/ideas/${idea.id}`}>{idea.title}</Link>{' '}
                  <span className="muted small">
                    impact {idea.impact} · effort {idea.effort}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {unscored.length > 0 && (
        <section className="card stack tight" aria-labelledby="matrix-unscored">
          <h2 id="matrix-unscored">
            Not scored yet <span className="count muted">{unscored.length}</span>
          </h2>
          <p className="muted small">Open an idea and set its impact and effort to place it on the matrix.</p>
          <ul className="matrix-ideas">
            {unscored.map((idea) => (
              <li key={idea.id}>
                <Link to={`/ideas/${idea.id}`}>{idea.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
