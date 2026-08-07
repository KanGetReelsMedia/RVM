const CACHE_NAME = 'rvm-hub-v3';
const APP_SHELL = [
  '/RVM/',
  '/RVM/index.html',
  '/RVM/manifest.json',
  '/RVM/offline.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL).catch(err => console.warn('Cache addAll failed', err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Don't cache Firebase, Google, Leaflet tiles - always network
  if (url.hostname.includes('firebaseio.com') || 
      url.hostname.includes('firestore') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('unpkg.com') ||
      url.hostname.includes('openstreetmap.org')) {
    return event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }

  // For navigation requests (HTML pages), network-first then offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Cache the page
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(res => res || caches.match('/RVM/offline.html') || caches.match('/RVM/'));
        })
    );
    return;
  }

  // For other assets, cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(netRes => {
        // Don't cache non-200
        if (!netRes || netRes.status !== 200 || netRes.type !== 'basic') return netRes;
        const clone = netRes.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return netRes;
      }).catch(() => {
        // If it's an image, return nothing, else offline
        if (event.request.destination === 'document') {
          return caches.match('/RVM/offline.html');
        }
      });
    })
  );
});    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).catch(() => {
          // Optional fallback for sub-resources if offline
        });
      })
    );
  }
});
