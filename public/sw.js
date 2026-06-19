const CACHE_VERSION = 'isivolpro-pwa-v2';
const APP_SHELL = [
  './',
  './manifest.webmanifest',
  './pwa-icon.svg',
  './pwa-maskable-icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => caches.match('./'))
    );
    return;
  }

  if (!url.pathname.includes('/assets/') && !url.pathname.endsWith('/manifest.webmanifest') && !url.pathname.endsWith('/pwa-icon.svg') && !url.pathname.endsWith('/pwa-maskable-icon.svg')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      return fetch(request).then((response) => {
        if (!response || response.status !== 200) return response;
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});
