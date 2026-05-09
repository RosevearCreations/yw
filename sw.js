const CACHE_NAME = 'devilndove-shell-v3';
const CORE_ASSETS = [
  '/',
  '/offline.html',
  '/css/styles.css',
  '/js/main.js',
  '/assets/logo-clear.png',
  '/assets/mark.png',
  '/assets/icons/icon-180.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/manifest.webmanifest',
  '/socials/'
];
const NO_CACHE_PATH_PREFIXES = ['/admin/', '/members/', '/login/', '/register/', '/account-help/', '/api/'];

function shouldBypassCache(url) {
  return NO_CACHE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (shouldBypassCache(url)) {
    event.respondWith(
      fetch(event.request).catch(() => {
        if (url.pathname.startsWith('/api/')) {
          return new Response(JSON.stringify({ ok: false, error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return caches.match(event.request).then((cached) => cached || caches.match('/offline.html'));
      })
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => null);
          }
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || caches.match('/offline.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => null);
          return response;
        })
        .catch(() => caches.match('/offline.html'));
    })
  );
});
