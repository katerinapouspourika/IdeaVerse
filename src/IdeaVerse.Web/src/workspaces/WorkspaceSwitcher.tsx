import { useNavigate } from 'react-router';

import { useWorkspace } from './WorkspaceContext';

const newWorkspace = 'new';

/** Header control for choosing which workspace's ideas to view, or starting a new workspace. */
export function WorkspaceSwitcher() {
  const { all, current, select } = useWorkspace();
  const navigate = useNavigate();

  if (!current) {
    return null;
  }

  const change = (value: string) => {
    if (value === newWorkspace) {
      void navigate('/workspaces/new');
      return;
    }
    select(value);
    void navigate('/');
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
