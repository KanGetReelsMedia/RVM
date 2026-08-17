const CACHE = 'rvm-v3';
// Only cache what we KNOW exists - don't crash if offline.html missing
const CORE_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      // Cache each individually so one 404 doesn't kill the SW
      for (const url of CORE_ASSETS) {
        try { await c.add(url); } catch (err) { console.warn('SW: failed to cache', url, err); }
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Never cache firebase / traccar live APIs
  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('firebasedatabase') || url.hostname.includes('firestore') || url.hostname.includes('traccar.org') || url.hostname.includes('token-transit')) {
    return; // let browser handle it normally
  }

  // For page navigations - network first, fallback to offline.html, then to index
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          // cache successful navigation
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          return (await cache.match('./offline.html')) || (await cache.match('./index.html')) || (await cache.match('/RVM/offline.html')) || (await cache.match('/RVM/index.html'));
        })
    );
    return;
  }

  // For CSS/JS/images - stale-while-revalidate
  e.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(netRes => {
        if (netRes && netRes.status === 200) {
          const clone = netRes.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return netRes;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
