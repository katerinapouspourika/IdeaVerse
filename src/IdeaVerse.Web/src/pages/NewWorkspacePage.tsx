import { useNavigate } from 'react-router';

import { usePageMeta } from '../seo/usePageMeta';
import { CompanyWorkspaces } from '../workspaces/CompanyWorkspaces';
import { CreateWorkspaceForm } from '../workspaces/CreateWorkspaceForm';

export function NewWorkspacePage() {
  usePageMeta('New workspace', { index: false });
  const navigate = useNavigate();
  return (
    <div className="stack">
      <h1>New workspace</h1>
      <CompanyWorkspaces />
      <CreateWorkspaceForm onCancel={() => void navigate(-1)} />
    </div>
  );
}
