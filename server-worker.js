'use strict';

/* =========================================================
   YWI HSE — server-worker.js
   Purpose:
   - Safe static asset caching only
   - Never cache POST/PUT/PATCH/DELETE requests
   - Ignore chrome-extension and other unsupported schemes
   - Ignore Supabase API/Auth/Storage/Function requests
   - Provide basic offline support for static frontend assets
========================================================= */

const CACHE_NAME = 'ywi-hse-static-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json'
];

/* =========================
   INSTALL
========================= */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          // Ignore missing optional assets during install
          console.warn('[SW] Failed to cache asset during install:', asset, err);
        }
      }
    })
  );
  self.skipWaiting();
});

/* =========================
   ACTIVATE
========================= */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

/* =========================
   HELPERS
========================= */
function isHttpRequest(request) {
  return request.url.startsWith('http://') || request.url.startsWith('https://');
}

function isGetRequest(request) {
  return request.method === 'GET';
}

function isSupabaseRequest(url) {
  return (
    url.includes('/auth/v1/') ||
    url.includes('/functions/v1/') ||
    url.includes('/storage/v1/') ||
    url.includes('/rest/v1/')
  );
}

function isUnsupportedScheme(url) {
  return (
    url.startsWith('chrome-extension://') ||
    url.startsWith('moz-extension://') ||
    url.startsWith('ms-browser-extension://') ||
    url.startsWith('file://')
  );
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function shouldBypass(request) {
  const url = request.url;

  if (!isHttpRequest(request)) return true;
  if (!isGetRequest(request)) return true;
  if (isUnsupportedScheme(url)) return true;
  if (isSupabaseRequest(url)) return true;

  return false;
}

/* =========================
   FETCH
========================= */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (shouldBypass(request)) {
    return;
  }

  // Navigation requests: network first, fallback to cached index
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/index.html', copy).catch(() => {});
          });
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          if (cached) return cached;
          return new Response('Offline', {
            status: 503,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // Static asset requests: stale-while-revalidate
  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse || Response.error());

      return cachedResponse || networkFetch;
    })
  );
});
