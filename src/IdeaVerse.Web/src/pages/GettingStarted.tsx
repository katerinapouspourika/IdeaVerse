import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import type { Account, Idea, Workspace } from '../api/types';

const storageKey = 'ideaverse.getting-started.hidden';

function readHidden(workspaceId: string): boolean {
  try {
    return localStorage.getItem(`${storageKey}.${workspaceId}`) === '1';
  } catch {
    return false;
  }
}

function saveHidden(workspaceId: string) {
  try {
    localStorage.setItem(`${storageKey}.${workspaceId}`, '1');
  } catch {
    // Hidden for this visit only.
  }
}

interface Step {
  label: string;
  done: boolean;
  to: string;
  state?: unknown;
}

/** A short checklist of first steps in a workspace, shown on the dashboard until they are done or the user hides it. */
export function GettingStarted({ workspace, ideas, account }: { workspace: Workspace; ideas: Idea[]; account: Account }) {
  const [hidden, setHidden] = useState(() => readHidden(workspace.id));
  const firstIdea = ideas[0];
  const steps: Step[] = [
    { label: 'Create a workspace', done: true, to: '/people' },
    { label: 'Add your first idea', done: ideas.length > 0, to: '/ideas', state: { adding: true } },
    { label: 'List what an idea needs', done: ideas.some((i) => i.componentCount > 0), to: firstIdea ? `/ideas/${firstIdea.id}` : '/ideas' },
    { label: 'Invite a teammate', done: workspace.memberCount > 1, to: '/people' },
    { label: 'Add your name, so your team knows it’s you', done: Boolean(account.displayName), to: '/settings' },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  if (hidden || doneCount === steps.length) {
    return null;
  }

  return (
    <section className="card stack getting-started" aria-labelledby="getting-started-heading">
      <div className="row spread">
        <div className="stack tight">
          <h2 id="getting-started-heading">Get started</h2>
          <p className="muted small">
            {doneCount} of {steps.length} done
          </p>
        </div>
        <button
          type="button"
          className="icon-button header-icon"
          aria-label="Hide getting started"
          onClick={() => {
            saveHidden(workspace.id);
            setHidden(true);
          }}
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="progress-track wide" aria-hidden="true">
        <span className="progress-fill" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="steps-list">
        {steps.map((step) => (
          <li key={step.label} className={step.done ? 'done' : undefined}>
            <span className="step-check" aria-hidden="true">
              {step.done && <Check size={14} />}
            </span>
            {step.done ? (
              <span>
                {step.label}
                <span className="visually-hidden"> (done)</span>
              </span>
            ) : (
              <Link to={step.to} state={step.state}>
                {step.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
