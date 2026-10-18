/** The colour scheme the user picked; "system" follows the device. `index.html` applies it before the page paints. */
export type Theme = 'system' | 'light' | 'dark';

const storageKey = 'ideaverse.theme';

/**
 * The header's background in each scheme, which the browser's bar above the installed app matches. `index.html` holds
 * the same colours in its `theme-color` tags and their pre-paint script, and the manifest the light one.
 */
export const themeColors = { light: '#fefdfc', dark: '#161c45' } as const;

/** Points both `theme-color` tags at the chosen scheme's colour, or each back at its own scheme's for "system". */
function applyThemeColor(theme: Theme) {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = themeColors[theme === 'system' ? own : theme];
  }
}

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
  applyThemeColor(theme);
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
