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
  /** Display name, or `null` when the person has not set one. */
  name: string | null;
  role: WorkspaceRole;
  joinedAt: string;
}

/** An open invitation, as the workspace's owner and admins see it. */
export interface Invitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  invitedByEmail: string;
  invitedByName: string | null;
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
  invitedByName: string | null;
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
  ownerName: string | null;
  memberCount: number;
  componentCount: number;
  completedComponentCount: number;
  createdAt: string;
  updatedAt: string;
  /** Lower case, in the order they were given. */
  tags: string[];
  /** When it was archived; `null` while it is active. */
  archivedAt: string | null;
}

export interface IdeaInput {
  title: string;
  description: string | null;
  targetDate: string;
  /** Omit to leave an idea's tags as they are. */
  tags?: string[];
}

export type IdeaSort = 'TargetDate' | 'Title' | 'Updated' | 'Created';

export const sortLabels: Record<IdeaSort, string> = {
  TargetDate: 'Target date',
  Title: 'Title',
  Updated: 'Recently changed',
  Created: 'Newest',
};

/** What to show of a workspace's ideas; every part is optional. */
export interface IdeaFilter {
  status?: IdeaStatus;
  search?: string;
  tag?: string;
  sort?: IdeaSort;
  /** Show the archive instead of the active ideas. */
  archived?: boolean;
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
  /** Who is responsible for it, if anyone. */
  assigneeId: string | null;
  assigneeEmail: string | null;
  assigneeName: string | null;
  /** ISO date it should be done by, `YYYY-MM-DD`, if any. */
  dueDate: string | null;
}

export interface ComponentInput {
  title: string;
  notes: string | null;
}

export interface ComponentUpdate extends ComponentInput {
  isDone: boolean;
  assigneeId: string | null;
  dueDate: string | null;
}

export interface Member {
  userId: string;
  email: string;
  /** Display name, or `null` when the person has not set one. */
  name: string | null;
  role: IdeaRole;
  addedAt: string;
}

/** What a notification is about: a countdown stage (the first four), or something a teammate did. */
export type ReminderKind = 'ComingUp' | 'Tomorrow' | 'Today' | 'Overdue' | 'Assigned' | 'AddedToTeam' | 'Commented';

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
  /** The name others see, or `null` until set. */
  displayName: string | null;
  /** IANA time zone deciding the user's "today" and when reminders arrive; `null` until chosen, when UTC applies. */
  timeZone: string | null;
  /** Whether reminders are emailed as well as shown in the app. */
  emailReminders: boolean;
  /** The reminder kinds the user gets, in stage order. */
  reminderKinds: ReminderKind[];
}

export interface ReminderSettings {
  emailReminders: boolean;
  reminderKinds: ReminderKind[];
}

export const statusLabels: Record<IdeaStatus, string> = {
  Planned: 'Planned',
  InProgress: 'In progress',
  Postponed: 'Postponed',
  Done: 'Done',
};

export const statuses = Object.keys(statusLabels) as IdeaStatus[];

/** Whether AI help is set up, and how much of today's allowance the workspace used. */
export interface AiStatus {
  enabled: boolean;
  used: number;
  limit: number;
}

export interface ComponentSuggestion {
  title: string;
  notes: string;
}

export interface IdeaImprovement {
  strengths: string[];
  weaknesses: string[];
  title: string;
  description: string;
}

export interface BrainstormedIdea {
  title: string;
  summary: string;
  targetAudience: string;
  differentiator: string;
  /** The critic's score, from 1 to 10. */
  score: number;
  strengths: string[];
  weaknesses: string[];
}

/** What to call a person: their display name, or their email when they have none. */
export function personLabel(name: string | null | undefined, email: string): string {
  return name?.trim() ? name : email;
}

export interface Comment {
  id: string;
  body: string;
  /** `null` once the author deleted their account. */
  authorEmail: string | null;
  authorName: string | null;
  createdAt: string;
  editedAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

export type ActivityKind =
  | 'Created'
  | 'Renamed'
  | 'DescriptionChanged'
  | 'Rescheduled'
  | 'StatusChanged'
  | 'Postponed'
  | 'ComponentAdded'
  | 'ComponentCompleted'
  | 'ComponentReopened'
  | 'ComponentRemoved'
  | 'MemberAdded'
  | 'MemberRemoved'
  | 'MemberLeft'
  | 'TagsChanged'
  | 'Archived'
  | 'Restored';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  detail: string | null;
  /** `null` once the person deleted their account. */
  actorEmail: string | null;
  actorName: string | null;
  createdAt: string;
}
