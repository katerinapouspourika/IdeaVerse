import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { request } from './client';
import type { Component, ComponentInput, ComponentUpdate, Idea, IdeaInput, IdeaStatus, IdeaUpdate, Member, Notifications } from './types';

export const keys = {
  ideas: (status?: IdeaStatus) => ['ideas', status ?? 'all'] as const,
  idea: (id: string) => ['idea', id] as const,
  components: (ideaId: string) => ['idea', ideaId, 'components'] as const,
  members: (ideaId: string) => ['idea', ideaId, 'members'] as const,
  notifications: ['notifications'] as const,
};

/** How often the app checks for new reminders while open. */
export const notificationPollMs = 60_000;

export function useIdeas(status?: IdeaStatus) {
  return useQuery({
    queryKey: keys.ideas(status),
    queryFn: () => request<Idea[]>('GET', status ? `/api/v1/ideas?status=${status}` : '/api/v1/ideas'),
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
    if (ideaId) {
      void client.invalidateQueries({ queryKey: ['idea', ideaId] });
    }
  };
}

export function useCreateIdea() {
  const invalidate = useInvalidateIdea();
  return useMutation({
    mutationFn: (input: IdeaInput) => request<Idea>('POST', '/api/v1/ideas', input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateIdea(id: string) {
  const invalidate = useInvalidateIdea();
  return useMutation({
    mutationFn: (input: IdeaUpdate) => request<Idea>('PUT', `/api/v1/ideas/${id}`, input),
    onSuccess: () => invalidate(id),
  });
}

export function usePostponeIdea(id: string) {
  const invalidate = useInvalidateIdea();
  return useMutation({
    mutationFn: (targetDate: string) => request<Idea>('POST', `/api/v1/ideas/${id}/postpone`, { targetDate }),
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
