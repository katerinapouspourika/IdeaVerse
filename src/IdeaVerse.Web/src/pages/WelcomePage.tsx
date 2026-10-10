import { CreateWorkspaceForm } from '../workspaces/CreateWorkspaceForm';
import { ReceivedInvitations } from '../workspaces/ReceivedInvitations';

/** Shown to someone in no workspace yet: join one they were invited to, or create their own. */
export function WelcomePage() {
  return (
    <div className="stack">
      <h1>Welcome to IdeaVerse</h1>
      <p className="muted">Ideas live in workspaces shared by a company or team. Join one you were invited to, or start your own.</p>
      <ReceivedInvitations />
      <CreateWorkspaceForm />
    </div>
  );
}
