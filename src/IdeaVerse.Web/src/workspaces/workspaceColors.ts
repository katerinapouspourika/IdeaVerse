import type { Workspace } from '../api/types';

/**
 * The colours a workspace can pick, matching the API's palette. Each keeps white text at 4.5:1 or more, so a workspace's
 * initial stays readable on it in light and dark mode.
 */
export const workspaceColors = {
  indigo: { label: 'Indigo', value: '#3a44c9' },
  blue: { label: 'Blue', value: '#1d4ed8' },
  teal: { label: 'Teal', value: '#0f766e' },
  green: { label: 'Green', value: '#15803d' },
  amber: { label: 'Amber', value: '#b45309' },
  orange: { label: 'Orange', value: '#c2410c' },
  rose: { label: 'Rose', value: '#be123c' },
  violet: { label: 'Violet', value: '#6d28d9' },
  slate: { label: 'Slate', value: '#475569' },
} as const;

export type WorkspaceColor = keyof typeof workspaceColors;

/** The workspace's colour, or the brand colour when it has none. */
export function colorOf(workspace: Pick<Workspace, 'color'>): string {
  return workspace.color && workspace.color in workspaceColors ? workspaceColors[workspace.color as WorkspaceColor].value : '#232b8f';
}

/** The address of the workspace's logo, versioned by its upload time so a new logo is never served from cache. */
export function logoUrl(workspace: Pick<Workspace, 'id' | 'logoUpdatedAt'>): string | null {
  return workspace.logoUpdatedAt ? `/api/v1/workspaces/${workspace.id}/logo?v=${encodeURIComponent(workspace.logoUpdatedAt)}` : null;
}
