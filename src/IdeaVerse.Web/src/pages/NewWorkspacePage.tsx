import { useNavigate } from 'react-router';

import { CreateWorkspaceForm } from '../workspaces/CreateWorkspaceForm';

export function NewWorkspacePage() {
  const navigate = useNavigate();
  return (
    <div className="stack">
      <h1>New workspace</h1>
      <CreateWorkspaceForm onCancel={() => void navigate(-1)} />
    </div>
  );
}
