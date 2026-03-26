/* File: server-worker.js
   Brief description: Service worker updated for the new security/account/api modules.
   Keeps static assets available offline while still avoiding auth callback, POST, and Supabase/API traffic.
*/

'use strict';

const CACHE_NAME = 'ywi-hse-shell-v10';
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/js/router.js',
  '/js/app-config.js',
  '/js/api.js',
  '/js/account-ui.js',
  '/js/security.js',
  '/js/bootstrap.js',
  '/js/auth.js',
  '/js/ui-auth.js',
  '/js/account-ui.js',
  '/js/profile-ui.js',
  '/js/reference-data.js',
  '/js/jobs-ui.js',
  '/js/admin-ui.js',
  '/js/logbook-ui.js',
  '/js/admin-actions.js',
  '/js/outbox.js',
  '/js/forms-toolbox.js',
  '/js/forms-ppe.js',
  '/js/forms-firstaid.js',
  '/js/forms-inspection.js',
  '/js/forms-drill.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    ).then(() => self.clients.claim())
  );
});

function isSupabaseRequest(url) {
  return url.origin.includes('supabase.co');
}


function isRuntimeConfigRequest(url) {
  return url.pathname === '/js/app-config.js';
}

function isApiLikeRequest(url) {
  return isSupabaseRequest(url) ||
    url.pathname.includes('/functions/v1/') ||
    url.pathname.includes('/auth/v1/') ||
    url.pathname.includes('/storage/v1/') ||
    url.pathname.includes('/rest/v1/');
}

function isAuthCallbackUrl(url) {
  const hash = url.hash || '';
  const search = url.search || '';
  const combined = `${search}${hash}`;
  return /(access_token|refresh_token|expires_at|expires_in|token_type|error|error_code|error_description|code)=/i.test(combined);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') {
    return;
  }

  if (isApiLikeRequest(url) || isAuthCallbackUrl(url)) {
    return;
  }

  if (isRuntimeConfigRequest(url)) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone();
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() =>
          caches.match(req).then((cached) => {
            if (cached) return cached;
            return caches.match('/index.html');
          })
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((response) => {
        const responseClone = response.clone();

        if (response.ok && url.origin === self.location.origin) {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, responseClone)).catch(() => {});
        }

        return response;
      });
    })
  );
});
