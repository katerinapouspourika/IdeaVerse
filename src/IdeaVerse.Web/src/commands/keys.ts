/** Whether the device names its command key ⌘ rather than Ctrl. */
export const usesCommandKey = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** How to write the palette's shortcut on this device. */
export const paletteShortcut = usesCommandKey ? '⌘K' : 'Ctrl+K';

/** Whether a key press happened while typing, where single-letter shortcuts must not fire. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * The letter a key press means, lower case: the key itself, or, on layouts whose letters aren't Latin (such as Greek or
 * Cyrillic), the Latin letter at the same place on the keyboard.
 */
export function letterOf(event: KeyboardEvent): string {
  const key = event.key.toLowerCase();
  if (/^[a-z]$/.test(key)) {
    return key;
  }
  return /^Key[A-Z]$/.test(event.code) ? event.code.slice(3).toLowerCase() : key;
}

/** The keyboard shortcuts, as the help dialog lists them: each is one or more alternatives, each a sequence of keys. */
export const shortcuts: { keys: string[][]; description: string }[] = [
  { keys: [[paletteShortcut], ['/']], description: 'Search ideas and run commands' },
  { keys: [['N']], description: 'New idea' },
  { keys: [['G', 'H']], description: 'Go to Home' },
  { keys: [['G', 'I']], description: 'Go to Ideas' },
  { keys: [['G', 'P']], description: 'Go to People' },
  { keys: [['G', 'N']], description: 'Go to Notifications' },
  { keys: [['G', 'S']], description: 'Go to Settings' },
  { keys: [['?']], description: 'Show these shortcuts' },
];
