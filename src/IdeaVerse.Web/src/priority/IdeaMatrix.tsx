import { useState } from 'react';
import { Link } from 'react-router';

import { maxScore, minScore, type Idea } from '../api/types';
import { useNarrowScreen } from '../components/useNarrowScreen';
import { useIdeaPanel } from '../panel/useIdeaPanel';
import { placementHints, placementLabels, placementOf, quadrants, type Placement, type Quadrant } from './priority';

/** The scores from high to low, as the impact axis reads from the top, and from low to high, as effort reads across. */
const scores = Array.from({ length: maxScore - minScore + 1 }, (_, i) => minScore + i);
const impactsDown = [...scores].reverse();

/** How many ideas a cell shows before folding the rest behind a "+N" button. */
const cellLimit = 3;

/**
 * Where each quadrant's shaded region sits on the grid, by grid lines: columns 3–7 are effort 1–5, rows 2–6 impact 5–1,
 * and rows 1 and 7 hold the top and bottom quadrants' labels. The centre row and column (a score of 3) stay unshaded.
 */
const regions: Record<Quadrant, { gridColumn: string; gridRow: string }> = {
  QuickWin: { gridColumn: '3 / 5', gridRow: '1 / 4' },
  BigBet: { gridColumn: '6 / 8', gridRow: '1 / 4' },
  NiceToHave: { gridColumn: '3 / 5', gridRow: '5 / 8' },
  TimeSink: { gridColumn: '6 / 8', gridRow: '5 / 8' },
};

/**
 * Scored ideas on a 5×5 grid of effort (across) against impact (up), each in the cell of its exact scores, over the
 * shaded quadrants; a 3 on either axis is the neutral centre between them. Each cell with ideas is a group named for its
 * scores and quadrant, so a screen reader hears the same as the grid shows. On a phone, where the cells would be too
 * small to read, the ideas are listed by quadrant instead. The ideas still to score follow either way.
 */
export function IdeaMatrix({ ideas }: { ideas: Idea[] }) {
  const narrow = useNarrowScreen();
  const scored = ideas.filter((i) => placementOf(i) !== null);
  const unscored = ideas.filter((i) => placementOf(i) === null);

  return (
    <div className="stack">
      {narrow ? (
        <MatrixList ideas={scored} />
      ) : (
        <>
          <p className="muted small">Each idea sits at its effort (across) and impact (up); a 3 on either is the neutral centre, between quadrants.</p>
          <MatrixGrid ideas={scored} />
        </>
      )}
      {unscored.length > 0 && (
        <section className="card stack tight" aria-labelledby="matrix-unscored">
          <h2 id="matrix-unscored">
            Not scored yet <span className="count muted">{unscored.length}</span>
          </h2>
          <p className="muted small">Open an idea and set its impact and effort to place it on the matrix.</p>
          <IdeaLinks ideas={unscored} />
        </section>
      )}
    </div>
  );
}

function MatrixGrid({ ideas }: { ideas: Idea[] }) {
  const at = (impact: number, effort: number) => ideas.filter((i) => i.impact === impact && i.effort === effort);
  const counts = new Map(quadrants.map((q) => [q, ideas.filter((i) => placementOf(i) === q).length]));

  return (
    <div className="matrix-grid" role="group" aria-label="Impact and effort matrix">
      {quadrants.map((q) => (
        <div key={q} className={`matrix-region ${q}`} style={regions[q]} aria-hidden="true">
          <span className="matrix-region-label">
            {placementLabels[q]} <span className="count">{counts.get(q)}</span>
          </span>
        </div>
      ))}
      <span className="matrix-axis impact" aria-hidden="true">
        Impact ↑
      </span>
      {impactsDown.map((impact, row) => (
        <span key={impact} className="matrix-score" style={{ gridColumn: 2, gridRow: row + 2 }} aria-hidden="true">
          {impact}
        </span>
      ))}
      {scores.map((effort) => (
        <span key={effort} className="matrix-score" style={{ gridColumn: effort + 2, gridRow: 8 }} aria-hidden="true">
          {effort}
        </span>
      ))}
      <span className="matrix-axis effort" aria-hidden="true">
        Effort →
      </span>
      {impactsDown.map((impact, row) =>
        scores.map((effort) => (
          <MatrixCell key={`${impact}-${effort}`} impact={impact} effort={effort} ideas={at(impact, effort)} style={{ gridColumn: effort + 2, gridRow: row + 2 }} />
        )),
      )}
    </div>
  );
}

/** One score pair's ideas as chips, folding all but a couple behind a "+N" button when there are many. */
function MatrixCell({ impact, effort, ideas, style }: { impact: number; effort: number; ideas: Idea[]; style: { gridColumn: number; gridRow: number } }) {
  const { linkProps } = useIdeaPanel();
  const [expanded, setExpanded] = useState(false);
  const placement = placementOf({ impact, effort })!;
  const centre = placement === 'Balanced';
  const className = centre ? 'matrix-square centre' : 'matrix-square';
  if (ideas.length === 0) {
    return <div className={className} style={style} />;
  }
  const folded = ideas.length > cellLimit && !expanded;
  const shown = folded ? ideas.slice(0, cellLimit - 1) : ideas;
  const label = `Impact ${impact}, effort ${effort}${centre ? '' : `, ${placementLabels[placement]}`}`;
  return (
    <div className={className} style={style} role="group" aria-label={label}>
      <ul className="matrix-chips">
        {shown.map((idea) => (
          <li key={idea.id}>
            <Link {...linkProps(idea.id)} className="matrix-chip" title={idea.title}>
              {idea.title}
            </Link>
          </li>
        ))}
      </ul>
      {ideas.length > cellLimit && (
        <button
          type="button"
          className="matrix-more"
          aria-expanded={expanded}
          aria-label={expanded ? `Show fewer ideas at impact ${impact}, effort ${effort}` : `Show ${ideas.length - shown.length} more ideas at impact ${impact}, effort ${effort}`}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Fewer' : `+${ideas.length - shown.length}`}
        </button>
      )}
    </div>
  );
}

/** The scored ideas grouped by quadrant, with their scores, for screens too narrow for the grid. */
function MatrixList({ ideas }: { ideas: Idea[] }) {
  const groups: Placement[] = [...quadrants, 'Balanced'];
  return groups.map((group) => {
    const members = ideas.filter((i) => placementOf(i) === group);
    if (members.length === 0) {
      return null;
    }
    return (
      <section key={group} className={`card stack tight matrix-group ${group}`} aria-labelledby={`matrix-${group}`}>
        <h2 id={`matrix-${group}`}>
          {placementLabels[group]} <span className="count muted">{members.length}</span>
        </h2>
        <p className="muted small">{placementHints[group]}</p>
        <IdeaLinks ideas={members} withScores />
      </section>
    );
  });
}

function IdeaLinks({ ideas, withScores = false }: { ideas: Idea[]; withScores?: boolean }) {
  const { linkProps } = useIdeaPanel();
  return (
    <ul className="matrix-ideas">
      {ideas.map((idea) => (
        <li key={idea.id}>
          <Link {...linkProps(idea.id)}>{idea.title}</Link>
          {withScores && (
            <>
              {' '}
              <span className="muted small">
                impact {idea.impact} · effort {idea.effort}
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
