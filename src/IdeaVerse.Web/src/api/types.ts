/** Mirrors the API contracts in src/IdeaVerse.Api. */

export type IdeaStatus = 'Planned' | 'InProgress' | 'Postponed' | 'Done';

/** The user's relationship to an idea: its owner, on its team, or someone else in its workspace. */
export type IdeaRole = 'Owner' | 'Member' | 'Viewer';

export type WorkspaceRole = 'Owner' | 'Admin' | 'Member';

export interface Workspace {
  id: string;
  name: string;
  role: WorkspaceRole;
  memberCount: number;
  createdAt: string;
}

export interface WorkspaceMember {
  userId: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}

/** An open invitation, as the workspace's owner and admins see it. */
export interface Invitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  invitedByEmail: string;
  sentAt: string;
  expiresAt: string;
}

/** An open invitation, as the invited person sees it. */
export interface ReceivedInvitation {
  id: string;
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
  invitedByEmail: string;
  expiresAt: string;
}

export interface Idea {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  /** ISO date, `YYYY-MM-DD`. */
  targetDate: string;
  status: IdeaStatus;
  postponeCount: number;
  isOverdue: boolean;
  role: IdeaRole;
  /** Whether the user may edit, postpone, and change the components of the idea. */
  canEdit: boolean;
  /** Whether the user may delete the idea and manage its team. */
  canManage: boolean;
  ownerEmail: string;
  memberCount: number;
  componentCount: number;
  completedComponentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaInput {
  title: string;
  description: string | null;
  targetDate: string;
}

export interface IdeaUpdate extends IdeaInput {
  status: IdeaStatus;
}

export interface Component {
  id: string;
  title: string;
  notes: string | null;
  isDone: boolean;
  position: number;
  createdAt: string;
  completedAt: string | null;
}

export interface ComponentInput {
  title: string;
  notes: string | null;
}

export interface ComponentUpdate extends ComponentInput {
  isDone: boolean;
}

export interface Member {
  userId: string;
  email: string;
  role: IdeaRole;
  addedAt: string;
}

export type ReminderKind = 'ComingUp' | 'Tomorrow' | 'Today' | 'Overdue';

export interface Notification {
  id: string;
  ideaId: string;
  ideaTitle: string;
  kind: ReminderKind;
  targetDate: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

export interface Notifications {
  items: Notification[];
  unreadCount: number;
}

export interface Account {
  email: string;
  /** IANA time zone deciding the user's "today" and when reminders arrive; `null` until chosen, when UTC applies. */
  timeZone: string | null;
}

export const statusLabels: Record<IdeaStatus, string> = {
  Planned: 'Planned',
  InProgress: 'In progress',
  Postponed: 'Postponed',
  Done: 'Done',
};

export const statuses = Object.keys(statusLabels) as IdeaStatus[];
