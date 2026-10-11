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

  const change = async (value: string) => {
    if (value === newWorkspace) {
      await navigate('/workspaces/new');
      return;
    }
    // An idea belongs to one workspace, so leave it for the new workspace's list first;
    // otherwise the idea page would switch straight back to the idea's own workspace. Other pages show the new workspace in place.
    if (pathname.startsWith('/ideas/')) {
      await navigate('/ideas');
    }
    select(value);
  };

  return (
    <select className="switcher" aria-label="Workspace" value={current.id} onChange={(e) => void change(e.target.value)}>
      {all.map((workspace) => (
        <option key={workspace.id} value={workspace.id}>
          {workspace.name}
        </option>
      ))}
      <option value={newWorkspace}>+ New workspace…</option>
    </select>
  );
}
