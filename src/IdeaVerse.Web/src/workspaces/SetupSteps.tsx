import { Check } from 'lucide-react';

const steps = ['Name your workspace', 'Invite your team'];

/** Where someone is in setting up a workspace: naming it, then inviting their team. */
export function SetupSteps({ current }: { current: 1 | 2 }) {
  return (
    <ol className="setup-steps" aria-label="Setting up your workspace">
      {steps.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        return (
          <li key={label} className={done ? 'done' : step === current ? 'current' : undefined} aria-current={step === current ? 'step' : undefined}>
            <span className="setup-step-number" aria-hidden="true">
              {done ? <Check size={14} /> : step}
            </span>
            {label}
            {done && <span className="visually-hidden"> (done)</span>}
          </li>
        );
      })}
    </ol>
  );
}
