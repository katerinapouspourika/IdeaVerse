import { useEffect } from 'react';

import type { Idea } from '../api/types';

/** An idea the user opened lately, as the command palette lists it before anything is typed. */
export interface RecentIdea {
  id: string;
  workspaceId: string;
  title: string;
}

const storageKey = 'ideaverse.recentIdeas';

/** How many ideas the browser remembers, across all workspaces; the palette shows a few of the current one's. */
const remembered = 20;

/** The ideas opened lately in this browser, most recent first. */
export function readRecentIdeas(): RecentIdea[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(stored)
      ? stored.filter(
          (entry): entry is RecentIdea =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as RecentIdea).id === 'string' &&
            typeof (entry as RecentIdea).workspaceId === 'string' &&
            typeof (entry as RecentIdea).title === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function write(update: (recent: RecentIdea[]) => RecentIdea[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(update(readRecentIdeas())));
  } catch {
    // Without storage the palette simply has no recent ideas to offer.
  }
}

/**
 * Remembers an idea as just opened, with its current title, while its page or side panel shows it, and forgets one
 * that no longer exists or is out of reach (`missing`).
 */
export function useRecentIdea(id: string, idea: Idea | undefined, missing: boolean) {
  const workspaceId = idea?.workspaceId;
  const title = idea?.title;
  useEffect(() => {
    if (workspaceId !== undefined && title !== undefined) {
      write((recent) => [{ id, workspaceId, title }, ...recent.filter((r) => r.id !== id)].slice(0, remembered));
    } else if (missing) {
      write((recent) => recent.filter((r) => r.id !== id));
    }
  }, [id, workspaceId, title, missing]);
}
