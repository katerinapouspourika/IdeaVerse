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
  /** One of the preset workspace colours, or null for the default. */
  color?: string | null;
  /** When the logo was last uploaded; null while there is none. */
  logoUpdatedAt?: string | null;
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
  /** How many people in the workspace voted for it. */
  voteCount: number;
  /** Whether the user voted for it. */
  hasVoted: boolean;
  /** How much it would matter, 1–5; `null` until scored. */
  impact: number | null;
  /** How much work it would take, 1–5; `null` until scored. */
  effort: number | null;
  /** ISO date work is planned to start, `YYYY-MM-DD`; `null` when none is planned. */
  startDate: string | null;
  /** Time of day work starts, `HH:mm:ss`, as entered; `null` when none was given. */
  startTime: string | null;
  /** The moment work starts; `null` when none is planned. */
  startsAt: string | null;
}

export interface IdeaInput {
  title: string;
  description: string | null;
  targetDate: string;
  /** Omit to leave an idea's tags as they are. */
  tags?: string[];
  /** Only when creating: when work starts, on or before the target date. */
  startDate?: string | null;
  /** Only when creating: the time of day work starts, `HH:mm`, in the user's time zone. */
  startTime?: string | null;
}

/** When work on an idea starts; a `null` date clears it. */
export interface StartInput {
  startDate: string | null;
  /** `HH:mm`, in the user's time zone; optional. */
  startTime: string | null;
}

export type IdeaSort = 'TargetDate' | 'Title' | 'Updated' | 'Created' | 'Votes' | 'Priority';

export const sortLabels: Record<IdeaSort, string> = {
  TargetDate: 'Target date',
  Title: 'Title',
  Updated: 'Recently changed',
  Created: 'Newest',
  Votes: 'Most votes',
  Priority: 'Impact for effort',
};

/** The lowest and highest impact or effort score. */
export const minScore = 1;
export const maxScore = 5;

export interface PriorityInput {
  impact: number | null;
  effort: number | null;
}

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

/** Takes back the caller's latest postponement, restoring the date and status it had before. */
export interface UndoPostpone {
  targetDate: string;
  status: IdeaStatus;
}

/** What a bulk change does to each idea it names. */
export type BulkIdeaOperation = 'SetStatus' | 'AddTag' | 'RemoveTag' | 'MoveTargetDate' | 'Archive' | 'Restore';

/** One change to several ideas at once (`POST /api/v1/ideas/bulk`), at most 100. */
export interface BulkIdeaRequest {
  ids: string[];
  operation: BulkIdeaOperation;
  /** For `SetStatus`. */
  status?: IdeaStatus;
  /** For `AddTag` and `RemoveTag`. */
  tag?: string;
  /** For `MoveTargetDate`: the new ISO date, `YYYY-MM-DD`; or give `days`. */
  targetDate?: string;
  /** For `MoveTargetDate`: how many days later each idea's own target date moves, 1–366; or give `targetDate`. */
  days?: number;
}

/** How a change to one idea went, as its own endpoint would have answered. */
export type ChangeOutcome = 'Changed' | 'NotFound' | 'Invalid' | 'Conflict' | 'Forbidden';

/** What a bulk change did to one idea, in the order asked; an idea named twice appears once. */
export interface BulkIdeaResult {
  id: string;
  outcome: ChangeOutcome;
  /** The idea after the change, when it applied. */
  idea: Idea | null;
  /** Why the change did not apply, when it did not. */
  message: string | null;
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

/** Every component of an idea, once each, in their new order. */
export interface ComponentOrder {
  componentIds: string[];
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

/** What a notification is about: a countdown stage (`ComingUp`, `Tomorrow`, `Today`, `Overdue`), a start reminder (`StartingSoon`, `AddComponents`), or something a teammate did. */
export type ReminderKind =
  | 'ComingUp'
  | 'Tomorrow'
  | 'Today'
  | 'Overdue'
  | 'Assigned'
  | 'AddedToTeam'
  | 'Commented'
  | 'Mentioned'
  | 'StartingSoon'
  | 'AddComponents';

export interface Notification {
  id: string;
  ideaId: string;
  ideaTitle: string;
  /** The workspace the idea belongs to. */
  workspaceId: string;
  workspaceName: string;
  kind: ReminderKind;
  targetDate: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  /** The comment a comment or mention is about, or `null` for other kinds and once the comment is deleted. */
  commentId: string | null;
  /** The component an assignment or a component's due date is about. */
  componentId: string | null;
  /** That component's current title, or `null` when there is none. */
  componentTitle: string | null;
}

/** Where a notification leads: its idea, at the comment or component it is about when there is one. */
export function notificationLink(notification: Pick<Notification, 'ideaId' | 'commentId' | 'componentId'>): string {
  const idea = `/ideas/${notification.ideaId}`;
  if (notification.commentId) return `${idea}#comment-${notification.commentId}`;
  if (notification.componentId) return `${idea}#component-${notification.componentId}`;
  return idea;
}

export interface Notifications {
  items: Notification[];
  unreadCount: number;
}

/** How often notifications are emailed: right away (several at once share one email) or in one email a day. */
export type EmailFrequency = 'RightAway' | 'DailyDigest';

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
  /** Whether comments on the user's ideas are emailed too (mentions are emailed regardless). */
  emailComments: boolean;
  /** Whether emails go out right away or in a daily digest at 08:00 local time; mentions always go right away. */
  emailFrequency: EmailFrequency;
}

export interface ReminderSettings {
  emailReminders: boolean;
  reminderKinds: ReminderKind[];
  emailComments: boolean;
  emailFrequency: EmailFrequency;
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

/** Whether the user may change the idea now: they can edit it and it is not archived, as archived ideas are read-only until restored. */
export function canChange(idea: Pick<Idea, 'canEdit' | 'archivedAt'>): boolean {
  return idea.canEdit && !idea.archivedAt;
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
  | 'Restored'
  | 'Rescored'
  | 'StartChanged';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  detail: string | null;
  /** `null` once the person deleted their account. */
  actorEmail: string | null;
  actorName: string | null;
  createdAt: string;
}

/** A page of an idea's history, newest first, from `GET /api/v1/ideas/{ideaId}/activity?page=&pageSize=`. */
export interface ActivityPage {
  /** Empty past the last page. */
  items: ActivityEntry[];
  /** How many entries the history holds in all. */
  totalCount: number;
  /** From 1. */
  page: number;
  pageSize: number;
}

/** An unfinished component assigned to the signed-in user. */
export interface Assignment {
  componentId: string;
  title: string;
  /** ISO date, `YYYY-MM-DD`, if it has one. */
  dueDate: string | null;
  ideaId: string;
  ideaTitle: string;
  ideaTargetDate: string;
}

/** Whether the contact form can send messages, and the address visitors may write to directly. */
export interface ContactStatus {
  available: boolean;
  email: string | null;
}

export interface ContactMessage {
  name: string;
  email: string;
  message: string;
  /** Left empty by people; filled in only by bots. */
  website?: string;
}

/** A workspace's invite link; `url` is null while it is turned off. */
export interface InviteLink {
  url: string | null;
}

/** The workspace behind an invite link. */
export interface JoinPreview {
  workspaceId: string;
  name: string;
  memberCount: number;
  alreadyMember: boolean;
}

/** Which company's people can find a workspace. */
export interface DiscoverySettings {
  domain: string | null;
  discoverable: boolean;
  /** The domain of the signed-in user's own email, when it is a company's. */
  suggestedDomain: string | null;
}

/** A workspace at the signed-in user's company that they can ask to join. */
export interface DiscoveredWorkspace {
  id: string;
  name: string;
  memberCount: number;
  requested: boolean;
}

/** Someone asking to join a workspace. */
export interface JoinRequest {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}
