/* KeepInTouch service worker.
 *
 * Deliberately minimal. Its job right now is to satisfy PWA installability —
 * which iOS requires before it will deliver Web Push at all — and to keep the
 * app shell available offline. The `push` and `notificationclick` handlers that
 * make reminders work are added in a later step.
 *
 * No runtime caching of API responses: contacts are per-user and change often,
 * and a stale cached list would be worse than a network error.
 */

const CACHE = 'keepintouch-shell-v1';

// Only truly static, always-present files. The JS bundle is content-hashed and
// its name changes every deploy, so it's cached on first fetch instead.
const SHELL = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      // A failed precache must not block installation, or the app becomes
      // uninstallable because one asset 404'd.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never touch Supabase or any other origin — auth and data must always be live.
  if (url.origin !== self.location.origin) return;

  // Navigations: network first so a new deploy is picked up immediately, falling
  // back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached ?? Response.error())),
    );
    return;
  }

  // Hashed static assets are immutable, so cache-first is safe and fast.
  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
            return response;
          }),
      ),
    );
  }
});
