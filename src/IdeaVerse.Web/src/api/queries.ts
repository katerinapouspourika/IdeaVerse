import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { request } from './client';
import type {
  ActivityPage,
  Assignment,
  AiStatus,
  BrainstormedIdea,
  Comment,
  Component,
  ComponentSuggestion,
  ComponentInput,
  ComponentOrder,
  ComponentUpdate,
  ContactMessage,
  ContactStatus,
  DiscoveredWorkspace,
  DiscoverySettings,
  InviteLink,
  JoinRequest,
  JoinPreview,
  Idea,
  IdeaImprovement,
  IdeaFilter,
  IdeaInput,
  IdeaStatus,
  IdeaUpdate,
  Invitation,
  Member,
  Notifications,
  PriorityInput,
  ReceivedInvitation,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from './types';

export const keys = {
  workspaces: ['workspaces'] as const,
  workspaceMembers: (workspaceId: string) => ['workspaces', workspaceId, 'members'] as const,
  invitations: (workspaceId: string) => ['workspaces', workspaceId, 'invitations'] as const,
  inviteLink: (workspaceId: string) => ['workspaces', workspaceId, 'invite-link'] as const,
  discovery: (workspaceId: string) => ['workspaces', workspaceId, 'discovery'] as const,
  joinRequests: (workspaceId: string) => ['workspaces', workspaceId, 'join-requests'] as const,
  discover: ['discover'] as const,
  receivedInvitations: ['invitations'] as const,
  ai: (workspaceId: string) => ['workspaces', workspaceId, 'ai'] as const,
  ideas: (workspaceId: string, query: string) => ['ideas', workspaceId, query] as const,
  tags: (workspaceId: string) => ['tags', workspaceId] as const,
  assignments: (workspaceId: string) => ['assignments', workspaceId] as const,
  idea: (id: string) => ['idea', id] as const,
  components: (ideaId: string) => ['idea', ideaId, 'components'] as const,
  members: (ideaId: string) => ['idea', ideaId, 'members'] as const,
  comments: (ideaId: string) => ['idea', ideaId, 'comments'] as const,
  activity: (ideaId: string) => ['idea', ideaId, 'activity'] as const,
  notifications: ['notifications'] as const,
};

/** How often the app checks for new reminders while open. */
export const notificationPollMs = 60_000;

export function useWorkspaces(enabled = true) {
  return useQuery({ queryKey: keys.workspaces, queryFn: () => request<Workspace[]>('GET', '/api/v1/workspaces'), enabled });
}

export function useCreateWorkspace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => request<Workspace>('POST', '/api/v1/workspaces', { name }),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.workspaces }),
  });
}

export function useRenameWorkspace(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => request<Workspace>('PUT', `/api/v1/workspaces/${workspaceId}`, { name }),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.workspaces, exact: true }),
  });
}

export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: keys.workspaceMembers(workspaceId),
    queryFn: () => request<WorkspaceMember[]>('GET', `/api/v1/workspaces/${workspaceId}/members`),
  });
}

/** Refreshes everything a change to a workspace's people can affect: workspaces, people, and ideas. */
function useInvalidatePeople() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: keys.workspaces });
    void client.invalidateQueries({ queryKey: ['ideas'] });
    void client.invalidateQueries({ queryKey: ['idea'] });
  };
}

export function useChangeRole(workspaceId: string) {
  const invalidate = useInvalidatePeople();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: WorkspaceRole }) =>
      request<WorkspaceMember>('PUT', `/api/v1/workspaces/${workspaceId}/members/${userId}`, { role }),
    onSuccess: invalidate,
  });
}

export function useRemoveWorkspaceMember(workspaceId: string) {
  const invalidate = useInvalidatePeople();
  return useMutation({
    mutationFn: (userId: string) => request<void>('DELETE', `/api/v1/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: invalidate,
  });
}

export function useInvitations(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.invitations(workspaceId),
    queryFn: () => request<Invitation[]>('GET', `/api/v1/workspaces/${workspaceId}/invitations`),
    enabled,
  });
}

export function useInvite(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: WorkspaceRole }) =>
      request<Invitation>('POST', `/api/v1/workspaces/${workspaceId}/invitations`, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.invitations(workspaceId) }),
  });
}

/** Sends an open invitation again with a fresh expiry; it keeps the role it was sent with. */
export function useResendInvitation(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      request<Invitation>('POST', `/api/v1/workspaces/${workspaceId}/invitations/${invitationId}/resend`),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.invitations(workspaceId) }),
  });
}

export function useRevokeInvitation(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => request<void>('DELETE', `/api/v1/workspaces/${workspaceId}/invitations/${invitationId}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.invitations(workspaceId) }),
  });
}

export function useReceivedInvitations() {
  return useQuery({
    queryKey: keys.receivedInvitations,
    queryFn: () => request<ReceivedInvitation[]>('GET', '/api/v1/invitations'),
  });
}

export function useAcceptInvitation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => request<Workspace>('POST', `/api/v1/invitations/${invitationId}/accept`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.receivedInvitations });
      void client.invalidateQueries({ queryKey: keys.workspaces });
    },
  });
}

export function useInviteLink(workspaceId: string) {
  return useQuery({
    queryKey: keys.inviteLink(workspaceId),
    queryFn: () => request<InviteLink>('GET', `/api/v1/workspaces/${workspaceId}/invite-link`),
  });
}

/** Turns the invite link on with a new address (replacing any earlier one), or off. */
export function useChangeInviteLink(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (on: boolean) =>
      on
        ? await request<InviteLink>('POST', `/api/v1/workspaces/${workspaceId}/invite-link`)
        : (await request<void>('DELETE', `/api/v1/workspaces/${workspaceId}/invite-link`), { url: null }),
    onSuccess: (link) => client.setQueryData(keys.inviteLink(workspaceId), link),
  });
}

export function useJoinPreview(token: string, enabled: boolean) {
  return useQuery({
    queryKey: ['join', token],
    queryFn: () => request<JoinPreview>('GET', `/api/v1/join/${encodeURIComponent(token)}`),
    enabled,
  });
}

export function useJoinByLink() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => request<Workspace>('POST', `/api/v1/join/${encodeURIComponent(token)}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.workspaces }),
  });
}

export function useDiscoverySettings(workspaceId: string) {
  return useQuery({
    queryKey: keys.discovery(workspaceId),
    queryFn: () => request<DiscoverySettings>('GET', `/api/v1/workspaces/${workspaceId}/discovery`),
  });
}

export function useSaveDiscoverySettings(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (settings: { domain: string | null; discoverable: boolean }) =>
      request<DiscoverySettings>('PUT', `/api/v1/workspaces/${workspaceId}/discovery`, settings),
    onSuccess: (settings) => client.setQueryData(keys.discovery(workspaceId), settings),
  });
}

/** The workspaces at the signed-in user's company they can ask to join. */
export function useDiscoveredWorkspaces() {
  return useQuery({ queryKey: keys.discover, queryFn: () => request<DiscoveredWorkspace[]>('GET', '/api/v1/discover') });
}

/** Asks to join a workspace found by company domain, or withdraws the request. */
export function useRequestToJoin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, ask }: { workspaceId: string; ask: boolean }) =>
      request<void>(ask ? 'POST' : 'DELETE', `/api/v1/discover/${workspaceId}/request`),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.discover }),
  });
}

export function useJoinRequests(workspaceId: string) {
  return useQuery({
    queryKey: keys.joinRequests(workspaceId),
    queryFn: () => request<JoinRequest[]>('GET', `/api/v1/workspaces/${workspaceId}/join-requests`),
  });
}

/** Approves or declines a request to join. */
export function useAnswerJoinRequest(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) =>
      approve
        ? request<void>('POST', `/api/v1/workspaces/${workspaceId}/join-requests/${requestId}/approve`)
        : request<void>('DELETE', `/api/v1/workspaces/${workspaceId}/join-requests/${requestId}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.joinRequests(workspaceId) });
      void client.invalidateQueries({ queryKey: keys.workspaceMembers(workspaceId) });
      void client.invalidateQueries({ queryKey: keys.workspaces, exact: true });
    },
  });
}

/** Sets the workspace's colour, uploads a new logo, or removes the logo. */
export function useChangeBranding(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (change: { color: string | null } | { logo: File | null }) =>
      'color' in change
        ? request<void>('PUT', `/api/v1/workspaces/${workspaceId}/color`, { color: change.color })
        : change.logo
          ? request<void>('PUT', `/api/v1/workspaces/${workspaceId}/logo`, change.logo)
          : request<void>('DELETE', `/api/v1/workspaces/${workspaceId}/logo`),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.workspaces, exact: true }),
  });
}

export function useDeclineInvitation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => request<void>('DELETE', `/api/v1/invitations/${invitationId}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.receivedInvitations }),
  });
}

/** The query string for `filter`, leaving out the parts that are not set or are defaults. */
export function ideaQuery(filter: IdeaFilter): string {
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  if (filter.search?.trim()) params.set('search', filter.search.trim());
  if (filter.tag) params.set('tag', filter.tag);
  if (filter.sort && filter.sort !== 'TargetDate') params.set('sort', filter.sort);
  if (filter.archived) params.set('archived', 'true');
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** A workspace's ideas; `enabled: false` waits, as the command palette does until something is typed. */
export function useIdeas(workspaceId: string, filter: IdeaFilter = {}, enabled = true) {
  const query = ideaQuery(filter);
  return useQuery({
    enabled,
    queryKey: keys.ideas(workspaceId, query),
    queryFn: () => request<Idea[]>('GET', `/api/v1/workspaces/${workspaceId}/ideas${query}`),
    placeholderData: keepPreviousData,
  });
}

export function useTags(workspaceId: string) {
  return useQuery({
    queryKey: keys.tags(workspaceId),
    queryFn: () => request<string[]>('GET', `/api/v1/workspaces/${workspaceId}/tags`),
  });
}

export function useIdea(id: string) {
  return useQuery({ queryKey: keys.idea(id), queryFn: () => request<Idea>('GET', `/api/v1/ideas/${id}`) });
}

export function useComponents(ideaId: string) {
  return useQuery({
    queryKey: keys.components(ideaId),
    queryFn: () => request<Component[]>('GET', `/api/v1/ideas/${ideaId}/components`),
  });
}

export function useMembers(ideaId: string) {
  return useQuery({
    queryKey: keys.members(ideaId),
    queryFn: () => request<Member[]>('GET', `/api/v1/ideas/${ideaId}/members`),
  });
}

/** Refreshes everything that shows an idea: lists, the idea itself, and its parts. */
function useInvalidateIdea() {
  const client = useQueryClient();
  return (ideaId?: string) => {
    void client.invalidateQueries({ queryKey: ['ideas'] });
    void client.invalidateQueries({ queryKey: ['tags'] });
    void client.invalidateQueries({ queryKey: ['assignments'] });
    if (ideaId) {
      void client.invalidateQueries({ queryKey: ['idea', ideaId] });
    }
  };
}

export function useCreateIdea(workspaceId: string) {
  const invalidate = useInvalidateIdea();
  return useMutation({
    mutationFn: (input: IdeaInput) => request<Idea>('POST', `/api/v1/workspaces/${workspaceId}/ideas`, input),
    onSuccess: () => invalidate(),
  });
}

/** Adds a list of components to an idea, one at a time so they keep their order, as starting from a template does. */
export function useAddComponents() {
  const invalidate = useInvalidateIdea();
  return useMutation({
    mutationFn: async ({ ideaId, components }: { ideaId: string; components: ComponentInput[] }) => {
      for (const component of components) {
        await request<Component>('POST', `/api/v1/ideas/${ideaId}/components`, component);
      }
    },
    onSettled: (_result, _error, { ideaId }) => invalidate(ideaId),
  });
}

export function useUpdateIdea(id: string) {
  const invalidate = useInvalidateIdea();
  return useMutation({
    mutationFn: (input: IdeaUpdate) => request<Idea>('PUT', `/api/v1/ideas/${id}`, input),
    onSuccess: () => invalidate(id),
  });
}

/** Changes an idea's status, keeping its other details, as the board does when an idea is dragged to another column. */
export function useMoveIdea() {
  const invalidate = useInvalidateIdea();
  const store = useStoreIdea();
  return useMutation({
    mutationFn: ({ idea, status }: { idea: Idea; status: IdeaStatus }) =>
      request<Idea>('PUT', `/api/v1/ideas/${idea.id}`, {
        title: idea.title,
        description: idea.description,
        targetDate: idea.targetDate,
        status,
        tags: idea.tags,
      } satisfies IdeaUpdate),
    onSuccess: store,
    onSettled: (_saved, _error, { idea }) => invalidate(idea.id),
  });
}

/** Puts a saved idea into the cached idea and lists at once, so a control doesn't flick back while they refresh. */
function useStoreIdea() {
  const client = useQueryClient();
  return (saved: Idea) => {
    client.setQueryData(keys.idea(saved.id), saved);
    client.setQueriesData<Idea[]>({ queryKey: ['ideas'] }, (ideas) => ideas?.map((i) => (i.id === saved.id ? saved : i)));
  };
}

/** Votes for an idea, or withdraws the vote. */
export function useVote() {
  const invalidate = useInvalidateIdea();
  const store = useStoreIdea();
  return useMutation({
    mutationFn: ({ idea, vote }: { idea: Idea; vote: boolean }) =>
      request<Idea>(vote ? 'PUT' : 'DELETE', `/api/v1/ideas/${idea.id}/vote`),
    onSuccess: store,
    onSettled: (_saved, _error, { idea }) => invalidate(idea.id),
  });
}

/** Scores an idea's impact and effort; `null` clears a score. */
export function useSetPriority() {
  const invalidate = useInvalidateIdea();
  const store = useStoreIdea();
  return useMutation({
    mutationFn: ({ idea, priority }: { idea: Idea; priority: PriorityInput }) =>
      request<Idea>('PUT', `/api/v1/ideas/${idea.id}/priority`, priority),
    onSuccess: store,
    onSettled: (_saved, _error, { idea }) => invalidate(idea.id),
  });
}

export function usePostponeIdea(id: string) {
  const invalidate = useInvalidateIdea();
  return useMutation({
    mutationFn: (targetDate: string) => request<Idea>('POST', `/api/v1/ideas/${id}/postpone`, { targetDate }),
    onSuccess: () => invalidate(id),
  });
}

export function useArchiveIdea(id: string) {
  const invalidate = useInvalidateIdea();
  return useMutation({
    mutationFn: (archive: boolean) => request<Idea>('POST', `/api/v1/ideas/${id}/${archive ? 'archive' : 'restore'}`),
    onSuccess: () => invalidate(id),
  });
}

export function useDeleteIdea(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => request<void>('DELETE', `/api/v1/ideas/${id}`),
    onSuccess: () => {
      client.removeQueries({ queryKey: ['idea', id] });
      void client.invalidateQueries({ queryKey: ['ideas'] });
      void client.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useAddComponent(ideaId: string) {
  const invalidate = useInvalidateIdea();
  return useMutation({
    mutationFn: (input: ComponentInput) => request<Component>('POST', `/api/v1/ideas/${ideaId}/components`, input),
    onSuccess: () => invalidate(ideaId),
  });
}

/** Updates a component and puts the saved version straight into the list, so it never flickers back. */
export function useUpdateComponent(ideaId: string) {
  const client = useQueryClient();
  const invalidate = useInvalidateIdea();
  return useMutation({
    mutationFn: ({ id, ...input }: ComponentUpdate & { id: string }) =>
      request<Component>('PUT', `/api/v1/ideas/${ideaId}/components/${id}`, input),
    onSuccess: (saved) => {
      client.setQueryData<Component[]>(keys.components(ideaId), (current) => current?.map((c) => (c.id === saved.id ? saved : c)));
      invalidate(ideaId);
    },
  });
}

/**
 * Puts an idea's components in a new order, showing it at once. Moves are saved one at a time, in the order they were made,
 * and once the last one is answered the list is reloaded, so it ends up as the server has it even if a move was refused.
 */
export function useReorderComponents(ideaId: string) {
  const client = useQueryClient();
  const mutationKey = ['reorder-components', ideaId];
  return useMutation({
    mutationKey,
    scope: { id: `reorder-components-${ideaId}` },
    mutationFn: (componentIds: string[]) =>
      request<Component[]>('PUT', `/api/v1/ideas/${ideaId}/components/order`, { componentIds } satisfies ComponentOrder),
    onMutate: async (componentIds) => {
      await client.cancelQueries({ queryKey: keys.components(ideaId) });
      const previous = client.getQueryData<Component[]>(keys.components(ideaId));
      if (previous) {
        const byId = new Map(previous.map((c) => [c.id, c]));
        client.setQueryData(
          keys.components(ideaId),
          componentIds.flatMap((id, position) => {
            const component = byId.get(id);
            return component ? [{ ...component, position }] : [];
          }),
        );
      }
    },
    onSettled: () => {
      if (client.isMutating({ mutationKey }) <= 1) {
        void client.invalidateQueries({ queryKey: keys.components(ideaId) });
      }
    },
  });
}

export function useDeleteComponent(ideaId: string) {
  const invalidate = useInvalidateIdea();
  return useMutation({
    mutationFn: (componentId: string) => request<void>('DELETE', `/api/v1/ideas/${ideaId}/components/${componentId}`),
    onSuccess: () => invalidate(ideaId),
  });
}

export function useAddMember(ideaId: string) {
  const invalidate = useInvalidateIdea();
  return useMutation({
    mutationFn: (email: string) => request<Member>('POST', `/api/v1/ideas/${ideaId}/members`, { email }),
    onSuccess: () => invalidate(ideaId),
  });
}

export function useRemoveMember(ideaId: string) {
  const invalidate = useInvalidateIdea();
  return useMutation({
    mutationFn: (userId: string) => request<void>('DELETE', `/api/v1/ideas/${ideaId}/members/${userId}`),
    onSuccess: () => invalidate(ideaId),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: () => request<Notifications>('GET', '/api/v1/notifications'),
    refetchInterval: notificationPollMs,
  });
}

export function useMarkNotificationRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<void>('POST', `/api/v1/notifications/${id}/read`),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.notifications }),
  });
}

export function useMarkAllNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => request<void>('POST', '/api/v1/notifications/read-all'),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.notifications }),
  });
}

export function useAiStatus(workspaceId: string) {
  return useQuery({ queryKey: keys.ai(workspaceId), queryFn: () => request<AiStatus>('GET', `/api/v1/workspaces/${workspaceId}/ai`) });
}

/** Runs an AI request, then refreshes the workspace's allowance whether or not it succeeded. */
function useAiMutation<TInput, TResult>(workspaceId: string, run: (input: TInput) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => void client.invalidateQueries({ queryKey: keys.ai(workspaceId) }),
  });
}

export function useSuggestComponents(ideaId: string, workspaceId: string) {
  return useAiMutation(workspaceId, () => request<ComponentSuggestion[]>('POST', `/api/v1/ideas/${ideaId}/ai/components`));
}

export function useImproveIdea(ideaId: string, workspaceId: string) {
  return useAiMutation(workspaceId, () => request<IdeaImprovement>('POST', `/api/v1/ideas/${ideaId}/ai/improve`));
}

export function useBrainstorm(workspaceId: string) {
  return useAiMutation(workspaceId, (brief: string) =>
    request<BrainstormedIdea[]>('POST', `/api/v1/workspaces/${workspaceId}/ai/brainstorm`, { brief }),
  );
}

export function useDeleteWorkspace(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => request<void>('DELETE', `/api/v1/workspaces/${workspaceId}`),
    onSuccess: () => {
      client.removeQueries({ queryKey: ['ideas', workspaceId] });
      void client.invalidateQueries({ queryKey: keys.workspaces });
    },
  });
}

export function useTransferOwnership(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => request<Workspace>('POST', `/api/v1/workspaces/${workspaceId}/transfer`, { userId }),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.workspaces }),
  });
}

export function useComments(ideaId: string) {
  return useQuery({ queryKey: keys.comments(ideaId), queryFn: () => request<Comment[]>('GET', `/api/v1/ideas/${ideaId}/comments`) });
}

function useCommentMutation<TInput>(ideaId: string, run: (input: TInput) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.comments(ideaId) }),
  });
}

export function useAddComment(ideaId: string) {
  return useCommentMutation(ideaId, (body: string) => request<Comment>('POST', `/api/v1/ideas/${ideaId}/comments`, { body }));
}

export function useEditComment(ideaId: string) {
  return useCommentMutation(ideaId, ({ id, body }: { id: string; body: string }) =>
    request<Comment>('PUT', `/api/v1/ideas/${ideaId}/comments/${id}`, { body }),
  );
}

export function useDeleteComment(ideaId: string) {
  return useCommentMutation(ideaId, (id: string) => request<void>('DELETE', `/api/v1/ideas/${ideaId}/comments/${id}`));
}

/** How many history entries the Activity card shows at a time. */
export const activityPageSize = 10;

/** A page of the idea's history; the idea's previous page stays on screen while the next one loads. */
export function useActivity(ideaId: string, page: number, enabled: boolean) {
  return useQuery({
    queryKey: [...keys.activity(ideaId), page],
    queryFn: () => request<ActivityPage>('GET', `/api/v1/ideas/${ideaId}/activity?page=${page}&pageSize=${activityPageSize}`),
    // Never another idea's history, when the same card moves on to a different idea.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === ideaId ? previous : undefined),
    enabled,
  });
}

export function useAssignments(workspaceId: string) {
  return useQuery({
    queryKey: keys.assignments(workspaceId),
    queryFn: () => request<Assignment[]>('GET', `/api/v1/workspaces/${workspaceId}/assignments`),
  });
}

export function useContactStatus() {
  return useQuery({
    queryKey: ['contact'],
    queryFn: () => request<ContactStatus>('GET', '/api/v1/contact'),
    staleTime: Infinity,
  });
}

export function useSendContactMessage() {
  return useMutation({
    mutationFn: (message: ContactMessage) => request<void>('POST', '/api/v1/contact', message),
  });
}
