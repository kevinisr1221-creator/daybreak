/**
 * Daybreak service worker.
 *
 * The page is rebuilt each morning by the Trello sync, so the document is
 * fetched network-first: a fresh sync is seen as soon as there is signal, and
 * the last good copy is served when there isn't. Icons and the manifest never
 * change without a version bump, so those are cache-first.
 *
 * Bump CACHE when shipping a change that must invalidate old copies.
 */

const CACHE = 'daybreak-v1';

// Relative so this keeps working from the /daybreak/ subpath.
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // One bad entry shouldn't fail the whole install, so warm them
      // individually and tolerate misses.
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let fonts etc. go to the network

  // Navigations and the document: network first, cache as the fallback.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Everything else: cache first, then fill in behind.
  event.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(request, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
