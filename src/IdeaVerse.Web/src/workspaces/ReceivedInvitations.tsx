import { useNavigate } from 'react-router';

import { formatDate } from '../api/dates';
import { useAcceptInvitation, useDeclineInvitation, useReceivedInvitations } from '../api/queries';
import { personLabel, type ReceivedInvitation } from '../api/types';
import { ErrorMessage } from '../components/ErrorMessage';
import { useWorkspace } from './WorkspaceContext';

/** The user's open invitations, each with Join and Decline; joining opens the workspace. */
export function ReceivedInvitations({ emptyText }: { emptyText?: string }) {
  const invitations = useReceivedInvitations();
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const { select } = useWorkspace();
  const navigate = useNavigate();

  const join = (invitation: ReceivedInvitation) => {
    accept.mutate(invitation.id, {
      onSuccess: (workspace) => {
        select(workspace.id);
        void navigate('/');
      },
    });
  };

  if (invitations.isLoading) {
    return <p className="muted">Loading invitations…</p>;
  }

  if (!invitations.data?.length) {
    return (
      <>
        <ErrorMessage error={invitations.error} />
        {emptyText && <p className="muted">{emptyText}</p>}
      </>
    );
  }

  return (
    <section className="card stack" aria-labelledby="invitations-heading">
      <h2 id="invitations-heading">You’re invited</h2>
      <ul className="team">
        {invitations.data.map((invitation) => (
          <li key={invitation.id}>
            <span>
              <strong>{invitation.workspaceName}</strong>
              <span className="muted small block">
                {personLabel(invitation.invitedByName, invitation.invitedByEmail)} invited you as {invitation.role === 'Admin' ? 'an admin' : 'a member'} · until{' '}
                {formatDate(invitation.expiresAt.slice(0, 10))}
              </span>
            </span>
            <span className="row">
              <button
                type="button"
                className="button primary small"
                aria-label={`Join ${invitation.workspaceName}`}
                disabled={accept.isPending}
                onClick={() => join(invitation)}
              >
                Join
              </button>
              <button
                type="button"
                className="button ghost small"
                aria-label={`Decline ${invitation.workspaceName}`}
                disabled={decline.isPending}
                onClick={() => decline.mutate(invitation.id)}
              >
                Decline
              </button>
            </span>
          </li>
        ))}
      </ul>
      <ErrorMessage error={accept.error ?? decline.error} />
    </section>
  );
}
