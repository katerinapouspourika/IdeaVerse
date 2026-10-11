import type { Idea } from '../api/types';

/** Where an idea sits on the impact × effort matrix. */
export type Quadrant = 'QuickWin' | 'BigBet' | 'NiceToHave' | 'TimeSink';

export const quadrants: Quadrant[] = ['QuickWin', 'BigBet', 'NiceToHave', 'TimeSink'];

export const quadrantLabels: Record<Quadrant, string> = {
  QuickWin: 'Quick wins',
  BigBet: 'Big bets',
  NiceToHave: 'Nice to haves',
  TimeSink: 'Time sinks',
};

export const quadrantHints: Record<Quadrant, string> = {
  QuickWin: 'High impact, little effort: do these first.',
  BigBet: 'High impact, a lot of effort: plan them carefully.',
  NiceToHave: 'Low impact, little effort: fit them in when there’s room.',
  TimeSink: 'Low impact, a lot of effort: question them.',
};

/** A score of this or more counts as high impact or high effort. */
const highScore = 3;

/** The idea's quadrant, or `null` until both its impact and effort are scored. */
export function quadrantOf(idea: Pick<Idea, 'impact' | 'effort'>): Quadrant | null {
  if (idea.impact === null || idea.effort === null) {
    return null;
  }
  const highImpact = idea.impact >= highScore;
  const highEffort = idea.effort >= highScore;
  return highImpact ? (highEffort ? 'BigBet' : 'QuickWin') : highEffort ? 'TimeSink' : 'NiceToHave';
}
