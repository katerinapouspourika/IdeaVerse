import { WorkspaceBadge } from './WorkspaceBadge';
import { useWorkspace } from './WorkspaceContext';

/** Names the workspace something belongs to, with its badge, for users in more than one; renders nothing for the rest. */
export function WorkspaceTag({ workspaceId, name }: { workspaceId: string; name: string }) {
  const { all } = useWorkspace();
  if (all.length < 2) {
    return null;
  }
  const workspace = all.find((w) => w.id === workspaceId);
  return (
    <span className="workspace-tag muted small">
      {workspace && <WorkspaceBadge workspace={workspace} size={18} />}
      <span>{workspace?.name ?? name}</span>
    </span>
  );
}
