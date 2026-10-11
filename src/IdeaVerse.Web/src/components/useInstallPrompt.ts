import { useEffect, useState } from 'react';

/** The event browsers that can install the app fire, which can later show their install dialog. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Offers to install the app where the browser allows it: `install` is set once the browser says the app can be installed,
 * shows the browser's own install dialog, and goes back to `null` once it has been used or the app is installed.
 */
export function useInstallPrompt(): { install: (() => Promise<void>) | null } {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const offer = (event: Event) => {
      // Keeps the browser's own banner from showing, so the account menu can offer it instead.
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const installed = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', offer);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  return {
    install: prompt
      ? async () => {
          await prompt.prompt();
          await prompt.userChoice;
          // A prompt can only be shown once; the browser offers a new one if the app is still not installed.
          setPrompt(null);
        }
      : null,
  };
}
