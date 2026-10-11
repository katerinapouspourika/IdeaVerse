/**
 * Remembers in the browser whether someone was signed in last time, so the first paint can guess before the account loads:
 * the public home page for visitors, a short wait for returning users. The login cookie itself is HTTP-only and unreadable here.
 * `index.html` reads the same key to hide the prerendered home page from returning users.
 */
const storageKey = 'ideaverse.session';

export function hadSession(): boolean {
  try {
    return localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

export function rememberSession(signedIn: boolean) {
  try {
    if (signedIn) {
      localStorage.setItem(storageKey, '1');
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch {
    // Without storage, returning users briefly see the public home page before their dashboard.
  }
}
