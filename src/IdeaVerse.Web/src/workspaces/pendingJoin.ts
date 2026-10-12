/** Where an invite link opened before signing in waits, in this browser, until the person is signed in. */
const storageKey = 'ideaverse.pendingJoin';

/** Remembers an invite link's secret, so signing up or in comes back to it. */
export function rememberJoin(token: string) {
  try {
    localStorage.setItem(storageKey, token);
  } catch {
    // Storage blocked: they can open the link again once signed in.
  }
}

/** The page of the invite link waiting to be used, if any. */
export function pendingJoinPath(): string | null {
  try {
    const token = localStorage.getItem(storageKey);
    return token ? `/join/${token}` : null;
  } catch {
    return null;
  }
}

/** Forgets the waiting invite link once it has been used or turned out not to work. */
export function forgetJoin() {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Nothing was stored.
  }
}
