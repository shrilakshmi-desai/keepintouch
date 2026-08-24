/* KeepInTouch service worker.
 *
 * Handles PWA installability (which iOS requires before it will deliver Web Push
 * at all), keeps the app shell available offline, and receives reminder pushes.
 *
 * No runtime caching of API responses: contacts are per-user and change often,
 * and a stale cached list would be worse than a network error.
 */

const CACHE = 'keepintouch-shell-v2';
const FALLBACK_TITLE = 'Time to reach out';
const FALLBACK_BODY = 'Tap to see who it is.';

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

/* ------------------------------------------------------------------ push */

/**
 * A push must always result in a visible notification — browsers revoke the
 * subscription if you receive one silently. So every failure path below still
 * shows something rather than returning early.
 */
self.addEventListener('push', (event) => {
  let title = FALLBACK_TITLE;
  let body = FALLBACK_BODY;
  let contactId = null;

  if (event.data) {
    try {
      const payload = event.data.json();
      if (typeof payload.title === 'string' && payload.title) title = payload.title;
      if (typeof payload.body === 'string' && payload.body) body = payload.body;
      if (typeof payload.contactId === 'string') contactId = payload.contactId;
    } catch {
      // Not JSON — fall back to the raw text rather than dropping the reminder.
      const text = event.data.text();
      if (text) body = text;
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Collapses repeats for the same person instead of stacking duplicates.
      tag: contactId ? `contact-${contactId}` : 'keepintouch-reminder',
      renotify: true,
      data: { contactId, url: contactId ? `/person/${contactId}` : '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Prefer focusing an open tab over opening a second copy of the app.
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'notification-click', url: target });
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
