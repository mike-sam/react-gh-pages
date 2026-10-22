/* Selfmanage Service Worker
 * - HTML / navigations: Network-First (avoid Safari white screen on stale index)
 * - Hashed static assets: Cache-First
 * Private Safari often has no SW — that is why Private can look "fine" while normal Safari blanks.
 */
const CACHE_NAME = 'selfmanage-static-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './favicon.svg',
  './logo.svg',
  './logo192.png',
  './logo512.png',
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

function isNavigationRequest(request, url) {
  if (request.mode === 'navigate') return true;
  const path = url.pathname || '';
  if (path.endsWith('.html')) return true;
  // GitHub Pages app shell: /react-gh-pages/ or /react-gh-pages
  if (path.endsWith('/') || /\/react-gh-pages\/?$/.test(path)) return true;
  return false;
}

function isHashedStatic(url) {
  // CRA build: /static/js/main.abc123.js , /static/css/main.abc123.css
  return /\/static\/(js|css|media)\//.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept cross-origin (GAS, Maps tiles, CDNs)
  if (url.origin !== self.location.origin) return;

  // Bypass cache when Force Reload adds ?ts=
  if (url.searchParams.has('ts')) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML shell: always try network first so deploys are not stuck on old index → missing chunks → blank
  if (isNavigationRequest(request, url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Hashed bundles: cache-first (filename changes every build)
  if (isHashedStatic(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Other same-origin: stale-while-revalidate style (network preferred)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
