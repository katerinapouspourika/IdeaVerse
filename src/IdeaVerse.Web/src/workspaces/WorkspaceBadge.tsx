import type { Workspace } from '../api/types';
import { colorOf, logoUrl } from './workspaceColors';

/** The workspace's logo, or its first letter on its colour when it has no logo. Decorative: its name is always shown nearby. */
export function WorkspaceBadge({ workspace, size = 32 }: { workspace: Workspace; size?: number }) {
  const logo = logoUrl(workspace);
  return logo ? (
    <img src={logo} alt="" className="workspace-badge" width={size} height={size} />
  ) : (
    <span className="workspace-badge" aria-hidden="true" style={{ width: size, height: size, background: colorOf(workspace), fontSize: size * 0.45 }}>
      {workspace.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
