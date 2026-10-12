import { Check, Circle } from 'lucide-react';

import { passwordRules } from './passwordRules';

/** The password rules as a checklist that ticks each one off as the password meets it. */
export function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="password-rules" aria-label="Requirements">
      {passwordRules.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.id} className={met ? 'met' : undefined}>
            {met ? <Check aria-hidden="true" size={14} /> : <Circle aria-hidden="true" size={14} />}
            {rule.label}
            <span className="visually-hidden">{met ? ' (done)' : ' (not yet)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
