const CACHE = 'cartograph-v1';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// App shell: cache-first. Map tiles / API calls: network-first, fall back to cache if offline.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isShell = SHELL.some((p) => url.pathname.endsWith(p.replace('./', '/')));

  if (isShell) {
    e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
