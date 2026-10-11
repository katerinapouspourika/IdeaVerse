/** The colour scheme the user picked; "system" follows the device. `index.html` applies it before the page paints. */
export type Theme = 'system' | 'light' | 'dark';

const storageKey = 'ideaverse.theme';

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: Theme) {
  if (theme === 'system') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  try {
    if (theme === 'system') {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, theme);
    }
  } catch {
    // The choice then lasts until the page is reloaded.
  }
}
