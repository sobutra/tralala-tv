/* Keeps the app itself available offline and quick to open. Always tries the network first,
   so updates show up on the next launch. Account data and videos are never cached here. */
const CACHE = 'lumera-shell-v3';
const SHELL = ['./', 'index.html', 'css/app.css?v=3', 'js/util.js?v=3', 'js/stremio.js?v=3', 'js/smart.js?v=3', 'js/player.js?v=3', 'js/app.js?v=3', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./'))));
});
