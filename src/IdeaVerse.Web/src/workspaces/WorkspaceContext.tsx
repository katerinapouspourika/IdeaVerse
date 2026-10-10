import { createContext, use, useState, type ReactNode } from 'react';

import { useWorkspaces } from '../api/queries';
import type { Workspace } from '../api/types';
import { useAuth } from '../auth/AuthContext';

interface Workspaces {
  /** The signed-in user's workspaces; empty until loaded, and when they have none. */
  all: Workspace[];
  /** The workspace being viewed: the one last chosen, or the first. */
  current: Workspace | null;
  isLoading: boolean;
  error: unknown;
  select: (workspaceId: string) => void;
}

const WorkspaceContext = createContext<Workspaces | null>(null);

const storageKey = 'ideaverse.workspace';

/** Reads the last chosen workspace; storage can be unavailable, as in private windows. */
function readChoice(): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function saveChoice(workspaceId: string) {
  try {
    localStorage.setItem(storageKey, workspaceId);
  } catch {
    // Not remembering the choice only means the first workspace shows next time.
  }
}

/** Loads the signed-in user's workspaces and tracks which one they are viewing. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const workspaces = useWorkspaces(account !== null);
  const [chosenId, setChosenId] = useState(readChoice);
  const all = account ? (workspaces.data ?? []) : [];
  const current = all.find((w) => w.id === chosenId) ?? all[0] ?? null;

  const select = (workspaceId: string) => {
    setChosenId(workspaceId);
    saveChoice(workspaceId);
  };

  return (
    <WorkspaceContext value={{ all, current, isLoading: account !== null && workspaces.isLoading, error: workspaces.error, select }}>
      {children}
    </WorkspaceContext>
  );
}

export function useWorkspace(): Workspaces {
  const workspaces = use(WorkspaceContext);
  if (!workspaces) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider.');
  }
  return workspaces;
}

/** Whether a role may manage a workspace's people, invitations, name, and ideas. */
export function canManageWorkspace(workspace: Workspace | null): boolean {
  return workspace?.role === 'Owner' || workspace?.role === 'Admin';
}
