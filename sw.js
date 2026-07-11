/* St Clair Live Scoring — service worker */
const VERSION = 'stclair-v14';

/* ===== notifications push ===== */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.title || 'St Clair', {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || 'stclair-' + Date.now(),
    data: { url: d.url || './' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return clients.openWindow(e.notification.data && e.notification.data.url || './');
  }));
});
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* API Supabase : toujours réseau (jamais de cache) */
  if (url.hostname.endsWith('supabase.co')) return;

  /* Navigation : réseau d'abord (pour les mises à jour), cache si hors-ligne */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(VERSION).then((c) => c.put('index.html', copy));
          return r;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  /* Statique (même origine, polices, CDN) : cache d'abord, réseau sinon */
  const cacheable =
    url.origin === location.origin ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'cdn.jsdelivr.net';
  if (cacheable) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((r) => {
            const copy = r.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
            return r;
          })
      )
    );
  }
});
