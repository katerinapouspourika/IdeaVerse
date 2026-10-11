import { useLocation, useNavigate } from 'react-router';

import { useWorkspace } from './WorkspaceContext';

const newWorkspace = 'new';

/** Header control for choosing which workspace's ideas to view, or starting a new workspace. */
export function WorkspaceSwitcher() {
  const { all, current, select } = useWorkspace();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!current) {
    return null;
  }

  const change = (value: string) => {
    if (value === newWorkspace) {
      void navigate('/workspaces/new');
      return;
    }
    select(value);
    // An idea belongs to one workspace, so leave it for the new workspace's list; other pages show the new workspace in place.
    if (pathname.startsWith('/ideas/')) {
      void navigate('/ideas');
    }
  };

  return (
    <select className="switcher" aria-label="Workspace" value={current.id} onChange={(e) => change(e.target.value)}>
      {all.map((workspace) => (
        <option key={workspace.id} value={workspace.id}>
          {workspace.name}
        </option>
      ))}
      <option value={newWorkspace}>+ New workspace…</option>
    </select>
  );
}
