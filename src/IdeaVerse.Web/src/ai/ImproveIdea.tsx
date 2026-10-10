import { useAiStatus, useImproveIdea, useUpdateIdea } from '../api/queries';
import type { Idea } from '../api/types';
import { ErrorMessage } from '../components/ErrorMessage';
import { AiAllowance, Thinking } from './AiAllowance';

/** Asks AI to critique an idea and propose a sharper title and description, which the user can use or dismiss. */
export function ImproveIdea({ idea }: { idea: Idea }) {
  const status = useAiStatus(idea.workspaceId);
  const improve = useImproveIdea(idea.id, idea.workspaceId);
  const update = useUpdateIdea(idea.id);

  if (!status.data?.enabled) {
    return null;
  }

  if (!improve.data) {
    return (
      <div className="stack">
        <div className="row">
          <button type="button" className="button ghost" onClick={() => improve.mutate(undefined)} disabled={improve.isPending}>
            Improve with AI
          </button>
        </div>
        {improve.isPending && <Thinking />}
        <ErrorMessage error={improve.error} />
      </div>
    );
  }

  const proposal = improve.data;
  const useProposal = () =>
    update.mutate(
      { title: proposal.title, description: proposal.description, targetDate: idea.targetDate, status: idea.status },
      { onSuccess: () => improve.reset() },
    );

  return (
    <section className="stack ai-panel" aria-label="AI review">
      <div className="columns">
        <div>
          <h3>What works</h3>
          <ul>
            {proposal.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>To sharpen</h3>
          <ul>
            {proposal.weaknesses.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <h3>Suggested version</h3>
        <p>
          <strong>{proposal.title}</strong>
        </p>
        <p className="description">{proposal.description}</p>
      </div>
      <ErrorMessage error={update.error} />
      <div className="row">
        <button type="button" className="button primary" onClick={useProposal} disabled={update.isPending}>
          Use this version
        </button>
        <button type="button" className="button ghost" onClick={() => improve.reset()}>
          Dismiss
        </button>
      </div>
      <AiAllowance status={status.data} />
    </section>
  );
}
