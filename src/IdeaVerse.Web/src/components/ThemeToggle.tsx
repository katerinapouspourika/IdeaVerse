import { Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';

import { applyTheme, readTheme, type Theme } from '../theme';

const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const labels: Record<Theme, string> = { system: 'Theme: match device', light: 'Theme: light', dark: 'Theme: dark' };

/** Cycles the colour scheme between the device's, light, and dark. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  const change = () => {
    const chosen = next[theme];
    applyTheme(chosen);
    setTheme(chosen);
  };

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <button type="button" className="icon-button header-icon" aria-label={labels[theme]} title={labels[theme]} onClick={change}>
      <Icon aria-hidden="true" size={20} />
    </button>
  );
}
