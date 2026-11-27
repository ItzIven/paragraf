// Service Worker: App-Hülle offline verfügbar machen.
// Bei jeder Veröffentlichung VERSION erhöhen, damit Geräte das Update laden.
const VERSION = 'paragraf-0.3.5';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/config.js', 'js/store.js', 'js/srs.js', 'js/content.js', 'js/ui.js', 'js/supabase.js',
  'js/views/heute.js', 'js/views/bloecke.js', 'js/views/karten.js', 'js/views/schemata.js',
  'js/views/pruefen.js', 'js/views/einstellungen.js', 'js/views/profiles.js',
  'content/blocks.json', 'content/demo/ao.json',
  'assets/icon.svg', 'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Eigene Dateien: erst Netz (damit Updates ankommen), bei Offline aus dem Cache.
// Supabase-Anfragen laufen am Service Worker vorbei.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
