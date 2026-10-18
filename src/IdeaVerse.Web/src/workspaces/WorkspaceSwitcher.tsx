import { ChevronDown, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

import { Menu } from '../components/Menu';
import { WorkspaceBadge } from './WorkspaceBadge';
import { useWorkspace } from './WorkspaceContext';

/**
 * Header menu for choosing which workspace's ideas to view: each workspace with its badge and the user's role, the
 * current one checked, and New workspace set apart at the end.
 */
export function WorkspaceSwitcher() {
  const { all, current, select } = useWorkspace();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!current) {
    return null;
  }

  const change = (workspaceId: string) => {
    if (workspaceId === current.id) {
      return;
    }
    select(workspaceId);
    // An idea belongs to one workspace, so leave it for the new workspace's list; other pages show the new workspace in place.
    if (pathname.startsWith('/ideas/')) {
      void navigate('/ideas');
    }
  };

  return (
    <Menu
      label={`Workspace: ${current.name}`}
      listLabel="Workspaces"
      triggerClassName="switcher"
      listClassName="switcher-list"
      trigger={
        <>
          <WorkspaceBadge workspace={current} size={28} />
          <span className="switcher-name">{current.name}</span>
          <ChevronDown className="switcher-chevron" aria-hidden="true" size={16} />
        </>
      }
      items={[
        ...all.map((workspace) => ({
          id: workspace.id,
          label: workspace.name,
          icon: <WorkspaceBadge workspace={workspace} size={28} />,
          detail: workspace.role,
          checked: workspace.id === current.id,
          onSelect: () => change(workspace.id),
        })),
        {
          id: 'new',
          label: 'New workspace',
          icon: (
            <span className="switcher-new-icon" aria-hidden="true">
              <Plus size={16} />
            </span>
          ),
          separated: true,
          onSelect: () => void navigate('/workspaces/new'),
        },
      ]}
    />
  );
}
