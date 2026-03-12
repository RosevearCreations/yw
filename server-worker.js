// =========================================================
// Document 8: /server-worker.js
// Purpose:
// - Safe service worker for YWI HSE
// - Cache only GET requests
// - Ignore chrome-extension, browser-internal, and POST requests
// - Basic offline support for app shell files
// =========================================================

const CACHE_NAME = 'ywi-hse-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of APP_SHELL) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('SW install skip:', url, err);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle normal GET requests
  if (request.method !== 'GET') return;

  // Ignore unsupported/browser/internal schemes
  if (!['http:', 'https:'].includes(url.protocol)) return;

  // Ignore browser extensions and other origins if desired
  if (url.protocol === 'chrome-extension:') return;

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;

      try {
        const response = await fetch(request);

        // Cache only successful basic responses
        if (
          response &&
          response.status === 200 &&
          (response.type === 'basic' || response.type === 'cors')
        ) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone()).catch(() => {});
        }

        return response;
      } catch (err) {
        // Fallback to cached index for navigation requests
        if (request.mode === 'navigate') {
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
        }

        throw err;
      }
    })
  );
});
