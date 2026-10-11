/**
 * Registers the service worker (`public/sw.js`), which makes the app installable and shows a friendly page when offline.
 * Only in production builds: during development the dev server's own modules must not be cached.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app works without it; installing and the offline page are extras.
    });
  });
}
