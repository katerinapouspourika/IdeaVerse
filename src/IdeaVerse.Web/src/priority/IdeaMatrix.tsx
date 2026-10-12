import { Link } from 'react-router';

import type { Idea } from '../api/types';
import { useIdeaPanel } from '../panel/useIdeaPanel';
import { placementHints, placementLabels, placementOf, quadrants, type Placement } from './priority';

/**
 * Places scored ideas on a 2×2 of impact against effort. Ideas with a medium 3 on either axis sit on the centre line,
 * listed as Balanced below the quadrants, followed by the ideas still to score.
 */
export function IdeaMatrix({ ideas }: { ideas: Idea[] }) {
  const { linkProps } = useIdeaPanel();
  const placed = new Map<Placement, Idea[]>([...quadrants, 'Balanced' as const].map((p) => [p, []]));
  const unscored: Idea[] = [];
  for (const idea of ideas) {
    const placement = placementOf(idea);
    if (placement) {
      placed.get(placement)!.push(idea);
    } else {
      unscored.push(idea);
    }
  }
  const balanced = placed.get('Balanced')!;

  const scoredList = (scored: Idea[]) => (
    <ul className="matrix-ideas">
      {scored.map((idea) => (
        <li key={idea.id}>
          <Link {...linkProps(idea.id)}>{idea.title}</Link>{' '}
          <span className="muted small">
            impact {idea.impact} · effort {idea.effort}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="stack">
      <p className="muted small">Scores of 4–5 count as high and 1–2 as low; a 3 on either axis is Balanced.</p>
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
              {placementLabels[q]} <span className="count muted">{placed.get(q)!.length}</span>
            </h2>
            <p className="muted small">{placementHints[q]}</p>
            {scoredList(placed.get(q)!)}
          </section>
        ))}
      </div>
      {balanced.length > 0 && (
        <section className="card stack tight matrix-cell Balanced" aria-labelledby="matrix-Balanced">
          <h2 id="matrix-Balanced">
            {placementLabels.Balanced} <span className="count muted">{balanced.length}</span>
          </h2>
          <p className="muted small">{placementHints.Balanced}</p>
          {scoredList(balanced)}
        </section>
      )}
      {unscored.length > 0 && (
        <section className="card stack tight" aria-labelledby="matrix-unscored">
          <h2 id="matrix-unscored">
            Not scored yet <span className="count muted">{unscored.length}</span>
          </h2>
          <p className="muted small">Open an idea and set its impact and effort to place it on the matrix.</p>
          <ul className="matrix-ideas">
            {unscored.map((idea) => (
              <li key={idea.id}>
                <Link {...linkProps(idea.id)}>{idea.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
