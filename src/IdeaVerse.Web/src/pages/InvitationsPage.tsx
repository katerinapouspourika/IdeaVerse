import { ReceivedInvitations } from '../workspaces/ReceivedInvitations';

/** The page invitation emails link to. */
export function InvitationsPage() {
  return (
    <div className="stack">
      <h1>Invitations</h1>
      <ReceivedInvitations emptyText="You have no open invitations. If you were expecting one, make sure you signed in with the email address it was sent to." />
    </div>
  );
}
