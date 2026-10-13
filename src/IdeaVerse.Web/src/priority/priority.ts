import type { Idea } from '../api/types';

/** Where an idea sits on the impact × effort matrix. */
export type Quadrant = 'QuickWin' | 'BigBet' | 'NiceToHave' | 'TimeSink';

/** A quadrant, or `Balanced` for an idea scored a medium 3 on impact or effort, which sits on the matrix's centre line. */
export type Placement = Quadrant | 'Balanced';

export const quadrants: Quadrant[] = ['QuickWin', 'BigBet', 'NiceToHave', 'TimeSink'];

export const placementLabels: Record<Placement, string> = {
  QuickWin: 'Quick wins',
  BigBet: 'Big bets',
  NiceToHave: 'Nice to haves',
  TimeSink: 'Time sinks',
  Balanced: 'Balanced',
};

export const placementHints: Record<Placement, string> = {
  QuickWin: 'High impact, little effort: do these first.',
  BigBet: 'High impact, a lot of effort: plan them carefully.',
  NiceToHave: 'Low impact, little effort: fit them in when there’s room.',
  TimeSink: 'Low impact, a lot of effort: question them.',
  Balanced: 'A medium 3 for impact or effort puts it on the centre line, between quadrants.',
};

/** A score of this or more counts as high impact or high effort. */
const highScore = 4;

/** A score of this or less counts as low impact or low effort; scores in between are medium. */
const lowScore = 2;

/**
 * The idea's place on the matrix: a quadrant when each score is high (4–5) or low (1–2), `Balanced` when either is a
 * medium 3, or `null` until both its impact and effort are scored.
 */
export function placementOf(idea: Pick<Idea, 'impact' | 'effort'>): Placement | null {
  if (idea.impact === null || idea.effort === null) {
    return null;
  }
  const isMedium = (score: number) => score > lowScore && score < highScore;
  if (isMedium(idea.impact) || isMedium(idea.effort)) {
    return 'Balanced';
  }
  const highImpact = idea.impact >= highScore;
  const highEffort = idea.effort >= highScore;
  return highImpact ? (highEffort ? 'BigBet' : 'QuickWin') : highEffort ? 'TimeSink' : 'NiceToHave';
}
