const CACHE = 'acisem-v1';
const STATIC_CACHE = 'acisem-static-v1';
const API_CACHE = 'acisem-api-v1';
const QUEUE_NAME = 'acisem-sync-queue';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa/icons/icon-192.svg',
  '/pwa/icons/icon-512.svg',
  '/assets/css/main.css',
  '/assets/css/layout.css',
  '/assets/css/components.css',
  '/assets/css/animations.css',
  '/assets/js/app.js',
  '/assets/js/api.js',
  '/assets/js/components/toast.js',
  '/assets/js/components/modal.js',
  '/assets/js/modules/dashboard.js',
  '/assets/js/modules/history.js',
  '/assets/js/modules/budget.js',
  '/assets/js/modules/multicomparison.js',
  '/assets/js/modules/providers.js',
  '/assets/js/modules/articles.js',
  '/assets/js/modules/users.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== STATIC_CACHE && k !== API_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Network first for API, fallback to cache
// Cache first for static assets
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (url.pathname.startsWith('/api/') && e.request.method === 'GET') {
    e.respondWith(networkFirstWithCache(e.request, API_CACHE));
    return;
  }

  if (e.request.method !== 'GET') {
    e.respondWith(networkFirstWithQueue(e.request));
    return;
  }

  if (url.origin === self.location.origin) {
    e.respondWith(cacheFirstWithNetwork(e.request));
    return;
  }

  e.respondWith(networkFirst(e.request));
});

// Background sync for offline mutations
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-pending') {
    e.waitUntil(processQueue());
  }
});

async function processQueue() {
  const cache = await caches.open(QUEUE_NAME);
  const requests = await cache.keys();
  for (const req of requests) {
    try {
      const response = await fetch(req);
      if (response.ok) {
        await cache.delete(req);
        const clients = await self.clients.matchAll();
        for (const client of clients) {
          client.postMessage({ type: 'sync-success', url: req.url });
        }
      }
    } catch (err) {
      console.error('Sync failed for', req.url, err);
    }
  }
}

async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Offline', { status: 408 });
  }
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline', message: 'Sin conexión' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response('Offline', { status: 408 });
  }
}

async function networkFirstWithQueue(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const clone = request.clone();
    const cache = await caches.open(QUEUE_NAME);
    await cache.put(request, new Response(JSON.stringify({ pending: true })));
    if (self.registration && self.registration.sync) {
      self.registration.sync.register('sync-pending').catch(() => {});
    }
    return new Response(JSON.stringify({ queued: true, message: 'Solicitud encolada para cuando haya conexión' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Listen for SSE stream (handled via EventSource in app, not SW)
// But we can cache SSE-like endpoints if needed
