// IdeaVerse's service worker: makes the app installable and keeps it usable on a flaky connection.
//
// - API calls (/api/...) always go to the network and are never stored, so no one's data is kept on the device.
// - Built files under /assets/ are named by their content, so once fetched they are served from the cache.
// - Pages try the network first and fall back to the last copy seen, or to a short "you're offline" page.
// - Icons, images, and fonts are served from the cache and refreshed in the background.
// Bump VERSION to drop everything cached by an earlier version.
const VERSION = 'v1';
const ASSETS = `ideaverse-assets-${VERSION}`;
const PAGES = `ideaverse-pages-${VERSION}`;
const STATIC = `ideaverse-static-${VERSION}`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const current = [ASSETS, PAGES, STATIC];
      for (const name of await caches.keys()) {
        if (name.startsWith('ideaverse-') && !current.includes(name)) {
          await caches.delete(name);
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/api') {
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(page(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSETS));
  } else if (/\.(png|webp|jpg|ico|svg|woff2|webmanifest)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});

async function page(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request)) ?? offline();
  }
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => undefined));
    return cached;
  }
  return refresh;
}

function offline() {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>You're offline · IdeaVerse</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #f6f1e7; color: #16204a; }
  main { max-width: 420px; margin: 16px; padding: 28px; border-radius: 16px; background: #fff; border: 1px solid #e4dacb; text-align: center; }
  button { font: inherit; font-weight: 700; padding: 10px 20px; border: 0; border-radius: 999px; background: #2b35b0; color: #fff; cursor: pointer; }
  @media (prefers-color-scheme: dark) { body { background: #0e1230; color: #eef1ff; } main { background: #171d48; border-color: #2a3270; } button { background: #7ec8ff; color: #0e1230; } }
</style>
</head>
<body>
<main>
  <h1>You're offline</h1>
  <p>IdeaVerse needs a connection to load your ideas. Check your connection and try again.</p>
  <button type="button" onclick="location.reload()">Try again</button>
</main>
</body>
</html>`;
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
