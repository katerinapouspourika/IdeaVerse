import { useId, useState } from 'react';

import type { AiStatus } from '../api/types';

/**
 * An AI action shown greyed out while AI help isn't set up for the workspace. It stays focusable and describes itself
 * with a note saying why: beside it, or, when `compact`, in a small bubble under it on hover, focus, or a tap.
 */
export function UnavailableAiButton({ label, compact = false }: { label: string; compact?: boolean }) {
  const noteId = useId();
  const [shown, setShown] = useState(false);
  return (
    <span className={compact ? 'ai-unavailable compact' : 'ai-unavailable'} data-shown={shown || undefined}>
      <button
        type="button"
        className="button ghost"
        aria-disabled="true"
        aria-describedby={noteId}
        onClick={() => setShown((open) => !open)}
        onBlur={() => setShown(false)}
      >
        {label}
      </button>
      <span id={noteId} className="ai-unavailable-note muted small">
        AI help isn’t set up for this workspace yet.
      </span>
    </span>
  );
}

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
