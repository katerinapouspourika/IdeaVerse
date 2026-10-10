import { vi } from 'vitest';

import type { Idea } from '../api/types';

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

export const signedIn = {
  'GET /api/v1/auth/manage/info': { status: 200, body: { email: 'kat@example.com' } },
  'GET /api/v1/notifications': { status: 200, body: { items: [], unreadCount: 0 } },
};

export const signedOut = { 'GET /api/v1/auth/manage/info': { status: 401 } };

export function anIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: 'idea-1',
    title: 'Black Friday teaser',
    description: 'TikTok series',
    targetDate: '2099-11-27',
    status: 'Planned',
    postponeCount: 0,
    isOverdue: false,
    role: 'Owner',
    memberCount: 0,
    componentCount: 0,
    completedComponentCount: 0,
    createdAt: '2026-10-01T09:00:00Z',
    updatedAt: '2026-10-01T09:00:00Z',
    ...overrides,
  };
}
