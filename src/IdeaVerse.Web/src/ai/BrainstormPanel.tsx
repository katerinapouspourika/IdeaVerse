import { useState, type FormEvent } from 'react';

import { useAiStatus, useBrainstorm } from '../api/queries';
import type { BrainstormedIdea } from '../api/types';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';
import { AiAllowance, Thinking } from './AiAllowance';

interface BrainstormPanelProps {
  workspaceId: string;
  /** Opens the new idea form filled in from a brainstormed idea. */
  onPick: (idea: BrainstormedIdea) => void;
  onClose: () => void;
}

/** Turns a goal into scored ideas the user can add. */
export function BrainstormPanel({ workspaceId, onPick, onClose }: BrainstormPanelProps) {
  const status = useAiStatus(workspaceId);
  const brainstorm = useBrainstorm(workspaceId);
  const [brief, setBrief] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    brainstorm.mutate(brief);
  };

  return (
    <section className="card stack ai-panel" aria-labelledby="brainstorm-heading">
      <div className="row spread">
        <h2 id="brainstorm-heading">Brainstorm with AI</h2>
        <button type="button" className="button ghost small" onClick={onClose}>
          Close
        </button>
      </div>
      <form className="stack" onSubmit={submit} aria-label="Brainstorm">
        <Field label="What do you want ideas for?" error={fieldError(brainstorm.error, 'brief')}>
          {(props) => (
            <textarea
              {...props}
              required
              rows={3}
              maxLength={1000}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. Grow sign-ups for our spring webinar series among small agencies"
            />
          )}
        </Field>
        <div className="row">
          <button type="submit" className="button primary" disabled={brainstorm.isPending}>
            Brainstorm
          </button>
        </div>
      </form>
      {status.data && <AiAllowance status={status.data} />}
      {brainstorm.isPending && <Thinking />}
      <ErrorMessage error={brainstorm.error} />
      {brainstorm.data && (
        <ul className="suggestions">
          {brainstorm.data.map((idea) => (
            <li key={idea.title} className="suggestion">
              <div className="row spread">
                <strong>{idea.title}</strong>
                <span className="badge" title="How promising the AI critic found it">
                  {idea.score}/10
                </span>
              </div>
              <p>{idea.summary}</p>
              <p className="muted small">
                For {idea.targetAudience}. {idea.differentiator}
              </p>
              {idea.weaknesses.length > 0 && <p className="muted small">Watch out: {idea.weaknesses.join(' ')}</p>}
              <div className="row">
                <button type="button" className="button small" onClick={() => onPick(idea)} aria-label={`Add ${idea.title}`}>
                  Add as idea
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The description a brainstormed idea starts with when added. */
export function describeBrainstormed(idea: BrainstormedIdea): string {
  return `${idea.summary}\n\nFor: ${idea.targetAudience}\nWhy it stands out: ${idea.differentiator}`;
}
