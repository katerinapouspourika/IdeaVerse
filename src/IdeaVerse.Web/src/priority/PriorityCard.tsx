import { useSetPriority } from '../api/queries';
import { canChange, maxScore, minScore, type Idea, type PriorityInput } from '../api/types';
import { useToast } from '../components/Feedback';
import { Field } from '../components/Field';
import { placementHints, placementLabels, placementOf } from './priority';
import { VoteButton } from './VoteButton';

const scoreLabels: Record<number, string> = { 1: 'Very low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Very high' };
const scores = Array.from({ length: maxScore - minScore + 1 }, (_, i) => minScore + i);

/** Votes, and the idea's impact and effort scores, which its team can change; each change saves straight away. */
export function PriorityCard({ idea }: { idea: Idea }) {
  const setPriority = useSetPriority();
  const toast = useToast();
  const shown = setPriority.isPending ? { ...idea, ...setPriority.variables.priority } : idea;
  const placement = placementOf(shown);
  const canScore = canChange(idea);

  const save = (priority: PriorityInput) =>
    setPriority.mutate({ idea, priority }, { onError: () => toast({ message: 'Couldn’t save the score. Try again.', tone: 'error' }) });

  return (
    <section className="card stack" aria-labelledby="priority-heading">
      <div className="row spread">
        <h2 id="priority-heading">Priority</h2>
        <VoteButton idea={idea} />
      </div>
      {canScore ? (
        <div className="row wrap priority-scores">
          <ScoreSelect label="Impact" value={shown.impact} saving={setPriority.isPending} onChange={(impact) => save({ impact, effort: shown.effort })} />
          <ScoreSelect label="Effort" value={shown.effort} saving={setPriority.isPending} onChange={(effort) => save({ impact: shown.impact, effort })} />
        </div>
      ) : (
        <dl className="facts">
          <dt>Impact</dt>
          <dd>{shown.impact === null ? 'Not scored' : `${shown.impact} · ${scoreLabels[shown.impact]}`}</dd>
          <dt>Effort</dt>
          <dd>{shown.effort === null ? 'Not scored' : `${shown.effort} · ${scoreLabels[shown.effort]}`}</dd>
        </dl>
      )}
      {placement ? (
        <p className="small">
          <strong className={`quadrant-tag ${placement}`}>{placementLabels[placement]}</strong> <span className="muted">{placementHints[placement]}</span>
        </p>
      ) : (
        <p className="muted small">Score impact and effort to place it on the matrix.</p>
      )}
    </section>
  );
}

interface ScoreSelectProps {
  label: string;
  value: number | null;
  /** Holds further changes until the last one is saved, so saves can't land out of order. */
  saving: boolean;
  onChange: (score: number | null) => void;
}

function ScoreSelect({ label, value, saving, onChange }: ScoreSelectProps) {
  return (
    <Field label={label}>
      {(props) => (
        <select {...props} value={value ?? ''} disabled={saving} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">Not scored</option>
          {scores.map((s) => (
            <option key={s} value={s}>
              {s} · {scoreLabels[s]}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
