import type { AiStatus } from '../api/types';

/** How many AI requests the workspace has left today. */
export function AiAllowance({ status }: { status: AiStatus }) {
  const left = Math.max(status.limit - status.used, 0);
  return (
    <p className="muted small">
      {left === 0
        ? 'Your workspace has used today’s AI requests. More are available tomorrow.'
        : `${left} of ${status.limit} AI requests left today for your workspace.`}
    </p>
  );
}

/** Shown while an AI request runs. */
export function Thinking() {
  return (
    <p className="muted" role="status">
      Thinking… this can take up to a minute.
    </p>
  );
}
