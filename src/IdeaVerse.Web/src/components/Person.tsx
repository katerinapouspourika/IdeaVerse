import type { ReactNode } from 'react';

import { personLabel } from '../api/types';

/**
 * A person in a list: their name, then their email on its own line, each cut short with an ellipsis rather than broken
 * mid-address, with the whole text on hover. Someone without a name shows just their email.
 */
export function Person({ name, email, after }: { name: string | null; email: string; after?: ReactNode }) {
  const label = personLabel(name, email);
  return (
    <span className="person">
      <span className="person-line" title={name ? undefined : email}>
        {label}
        {after}
      </span>
      {name && (
        <>
          {' '}
          <span className="person-line muted small" title={email}>
            {email}
          </span>
        </>
      )}
    </span>
  );
}
