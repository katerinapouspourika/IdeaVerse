import { vi } from 'vitest';

import type { Account, Idea, Workspace } from '../api/types';

type Handler = (body: unknown) => { status: number; body?: unknown };

export interface Call {
  method: string;
  path: string;
  body: unknown;
}

/**
 * Replaces `fetch` with a table of `"METHOD /path"` handlers. Unknown routes return 404.
 * Returns the list of calls made, for assertions.
 */
export function fakeApi(routes: Record<string, Handler | { status: number; body?: unknown }>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, path: input, body });
      const route = routes[`${method} ${input}`];
      const result = typeof route === 'function' ? route(body) : (route ?? { status: 404 });
      return new Response(result.body === undefined ? null : JSON.stringify(result.body), {
        status: result.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return calls;
}

export function aWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return { id: 'ws-1', name: 'Acme Marketing', role: 'Owner', memberCount: 1, createdAt: '2026-10-01T09:00:00Z', ...overrides };
}

/** The route listing the ideas of the default workspace. */
export const ideasRoute = 'GET /api/v1/workspaces/ws-1/ideas';

/** The signed-in user's account: UTC, every reminder, by email. */
export const signedInAccount: Account = {
  email: 'kat@example.com',
  timeZone: 'UTC',
  emailReminders: true,
  reminderKinds: ['ComingUp', 'Tomorrow', 'Today', 'Overdue'],
};

/** A signed-in user who owns one workspace, with no reminders or invitations. */
export const signedIn = {
  'GET /api/v1/account': { status: 200, body: signedInAccount },
  'GET /api/v1/notifications': { status: 200, body: { items: [], unreadCount: 0 } },
  'GET /api/v1/workspaces': { status: 200, body: [aWorkspace()] },
  'GET /api/v1/invitations': { status: 200, body: [] },
};

export const signedOut = { 'GET /api/v1/account': { status: 401 } };

export function anIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: 'idea-1',
    workspaceId: 'ws-1',
    title: 'Black Friday teaser',
    description: 'TikTok series',
    targetDate: '2099-11-27',
    status: 'Planned',
    postponeCount: 0,
    isOverdue: false,
    role: 'Owner',
    canEdit: true,
    canManage: true,
    ownerEmail: 'kat@example.com',
    memberCount: 0,
    componentCount: 0,
    completedComponentCount: 0,
    createdAt: '2026-10-01T09:00:00Z',
    updatedAt: '2026-10-01T09:00:00Z',
    ...overrides,
  };
}
