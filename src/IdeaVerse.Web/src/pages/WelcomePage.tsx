import { useReceivedInvitations } from '../api/queries';
import { CompanyWorkspaces } from '../workspaces/CompanyWorkspaces';
import { CreateWorkspaceForm } from '../workspaces/CreateWorkspaceForm';
import { ReceivedInvitations } from '../workspaces/ReceivedInvitations';
import { SetupSteps } from '../workspaces/SetupSteps';

/**
 * Shown to someone in no workspace yet. Someone invited sees their invitations first, and can still start their own;
 * everyone else starts setting up their workspace: naming it, then inviting their team. Either way, workspaces at their
 * company are offered to ask to join.
 */
export function WelcomePage({ onCreated }: { onCreated?: () => void }) {
  const invitations = useReceivedInvitations();
  const invited = (invitations.data?.length ?? 0) > 0;

  return (
    <div className="stack setup">
      <h1>Welcome to IdeaVerse</h1>
      {invited ? (
        <>
          <p className="muted">You’ve been invited to a workspace. Join it to see your team’s ideas, or start one of your own.</p>
          <ReceivedInvitations />
          <CompanyWorkspaces />
          <CreateWorkspaceForm heading="Or start your own workspace" onCreated={onCreated} askName />
        </>
      ) : (
        <>
          <p className="muted">Ideas live in a workspace you share with your company or team. Let’s set yours up; it takes a minute.</p>
          <CompanyWorkspaces />
          <SetupSteps current={1} />
          <CreateWorkspaceForm heading="Name your workspace" onCreated={onCreated} askName />
          <p className="muted small">Expecting an invitation instead? Ask a teammate to invite this email address; it will appear here.</p>
        </>
      )}
    </div>
  );
}
