/** Mirrors the API contracts in src/IdeaVerse.Api. */

export type IdeaStatus = 'Planned' | 'InProgress' | 'Postponed' | 'Done';

export type IdeaRole = 'Owner' | 'Member';

export interface Idea {
  id: string;
  title: string;
  description: string | null;
  /** ISO date, `YYYY-MM-DD`. */
  targetDate: string;
  status: IdeaStatus;
  postponeCount: number;
  isOverdue: boolean;
  role: IdeaRole;
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
}

export const statusLabels: Record<IdeaStatus, string> = {
  Planned: 'Planned',
  InProgress: 'In progress',
  Postponed: 'Postponed',
  Done: 'Done',
};

export const statuses = Object.keys(statusLabels) as IdeaStatus[];
