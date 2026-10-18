import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { applyTheme, readTheme, type Theme } from '../theme';
import { Menu } from './Menu';

const darkQuery = '(prefers-color-scheme: dark)';

/** Whether the device prefers dark, following changes; light where the browser cannot tell, or while prerendering. */
function useDeviceDark() {
  const [dark, setDark] = useState(() => typeof window !== 'undefined' && (window.matchMedia?.(darkQuery).matches ?? false));
  useEffect(() => {
    const query = window.matchMedia?.(darkQuery);
    if (!query) {
      return;
    }
    const change = () => setDark(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return dark;
}

const options: { theme: Theme; label: string; icon: typeof Sun }[] = [
  { theme: 'light', label: 'Light', icon: Sun },
  { theme: 'dark', label: 'Dark', icon: Moon },
  { theme: 'system', label: 'Match device', icon: Monitor },
];

/** Picks the colour scheme: light, dark, or the device's. The icon shows the scheme in effect. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const deviceDark = useDeviceDark();
  const dark = theme === 'dark' || (theme === 'system' && deviceDark);

  const Icon = dark ? Moon : Sun;
  return (
    <Menu
      label={`Theme: ${dark ? 'dark' : 'light'}${theme === 'system' ? ' (matches device)' : ''}`}
      triggerClassName="icon-button header-icon"
      trigger={<Icon aria-hidden="true" size={20} />}
      items={options.map((option) => ({
        label: option.label,
        icon: <option.icon aria-hidden="true" size={16} />,
        checked: option.theme === theme,
        onSelect: () => {
          applyTheme(option.theme);
          setTheme(option.theme);
        },
      }))}
    />
  );
}
