/* eslint-env serviceworker */
/**
 * Shanaya OS service worker (spec §17).
 *
 * Hand-written (no Workbox) with three strategies:
 * 1. Static assets (_next/static, icons, fonts): cache-first, immutable.
 * 2. Navigations: network-first with a cached "today" shell fallback.
 * 3. API/Supabase reads for today's data: stale-while-revalidate so tasks,
 *    events, and prayer times are available offline.
 *
 * Offline capture itself is queued in IndexedDB by the page and flushed on
 * the `online` event — the SW never writes to the database.
 */

const VERSION = 'shanaya-os-v1';
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;
const DATA_CACHE = `${VERSION}-data`;

const PRECACHE = [
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticRequest(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|woff2?|ttf)$/.test(url.pathname)
  );
}

/** Supabase GET reads for today's data (tasks, events, prayer). */
function isTodayDataRequest(url) {
  if (!url.hostname.endsWith('.supabase.co')) return false;
  const q = url.search.toLowerCase();
  return (
    url.pathname.includes('/rest/v1/') &&
    (q.includes('tasks') ||
      q.includes('events') ||
      q.includes('prayer_schedules') ||
      q.includes('prayer_logs') ||
      q.includes('profiles') ||
      q.includes('settings'))
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !isTodayDataRequest(url)) return;

  // 1. Static assets: cache-first.
  if (isStaticRequest(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // 2. Supabase reads: stale-while-revalidate.
  if (isTodayDataRequest(url)) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // 3. Navigations: network-first with offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const shell = await caches.match('/offline');
          return shell || Response.error();
        }),
    );
    return;
  }

  // 4. Same-origin GETs: network-first with cache fallback.
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request)),
  );
});

/** Background sync hook: pages flush their own IndexedDB queue on `online`. */
self.addEventListener('sync', (event) => {
  if (event.tag === 'shanaya-capture-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        for (const client of clients) client.postMessage({ type: 'flush-capture-queue' });
      }),
    );
  }
});
