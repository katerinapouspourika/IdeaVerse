import { findTemplate, type IdeaTemplate } from './templates';

/** Where the template a visitor chose before signing up waits, in this browser, until they reach their ideas. */
const storageKey = 'ideaverse.pendingTemplate';

/** Remembers the template a visitor chose, so it is ready once they have signed up, confirmed, and signed in. */
export function rememberTemplate(slug: string) {
  try {
    localStorage.setItem(storageKey, slug);
  } catch {
    // Storage blocked: they can still pick the template from the New idea form.
  }
}

/** The template waiting to be used, if any. */
export function pendingTemplate(): IdeaTemplate | undefined {
  try {
    return findTemplate(localStorage.getItem(storageKey) ?? undefined);
  } catch {
    return undefined;
  }
}

/** Forgets the waiting template once its form has opened. */
export function forgetPendingTemplate() {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Nothing was stored.
  }
}
