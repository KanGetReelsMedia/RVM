const CACHE = 'rvm-v2';
const CORE_ASSETS = [
  '/RVM/',
  '/RVM/index.html',
  '/RVM/offline.html',
  '/RVM/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Don't cache Firebase realtime / Traccar API - always network
  const url = new URL(e.request.url);
  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('firebasedatabase') || url.hostname.includes('traccar') || url.hostname.includes('token-transit')) {
    return e.respondWith(
      fetch(e.request).catch(() => {
        // If it's a navigation request and Firebase fails, show offline page
        if (e.request.mode === 'navigate') {
          return caches.match('/RVM/offline.html');
        }
      })
    );
  }

  // For navigation (user opening app) - network first, fallback to offline.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        return caches.open(CACHE).then(c => {
          c.put(e.request, res.clone());
          return res;
        });
      }).catch(() => caches.match('/RVM/offline.html'))
    );
    return;
  }

  // For everything else - stale while revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
