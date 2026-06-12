const CACHE = 'hd-ic-v20';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './img/icon-192.png',
  './src/app.js',
  './src/config/app.config.js',
  './src/data/demo.data.js',
  './src/services/auth.service.js',
  './src/services/db.service.js',
  './src/services/storage.service.js',
  './src/components/modal.component.js',
  './src/components/toast.component.js',
  './src/modules/access.module.js',
  './src/modules/dashboard.module.js',
  './src/modules/infection.module.js',
  './src/modules/patient.module.js',
  './src/modules/report.module.js',
  './src/modules/serology.module.js',
  './src/modules/surveillance.module.js',
  './src/utils/date.util.js',
  './src/utils/dom.util.js',
  './src/styles/base.css',
  './src/styles/components.css',
  './src/styles/layout.css',
  './src/styles/modals.css',
  './src/styles/navigation.css',
  './src/styles/responsive.css',
  './src/styles/tables.css',
  './src/styles/variables.css',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
