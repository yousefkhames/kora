const CACHE = 'kora-v3';
const FILES = ['assets/yk-logo.svg', 'fonts/fonts.css','fonts/Cairo-arabic.woff2','fonts/Cairo-latin.woff2','./', 'index.html', 'styles.css', 'core.js', 'i18n.js', 'app.js', 'logo.svg', 'manifest.webmanifest', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('kora-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// network first so updates show up, cache as the offline fallback
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
