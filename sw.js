// Service Worker — cache tout ce qu'il faut pour le mode hors-ligne
const CACHE_NAME = 'hsk-trainer-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './hsk-content.js',
  './lessons.js',
  './icon-192.png',
  './icon-512.png',
  // CDN libs (mises en cache à la 1ère visite, puis dispo offline)
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Noto+Sans+SC:wght@300;400;500;700&display=swap',
];

// URLs à NE JAMAIS mettre en cache (toujours faire un appel réseau frais)
const NO_CACHE_HOSTS = [
  'hsk-backend.tom-delaine14.workers.dev',
  'api.anthropic.com',
];

function shouldBypassCache(url) {
  return NO_CACHE_HOSTS.some(host => url.includes(host));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS).catch(err => {
        console.warn('Some assets failed to cache:', err);
      }))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Bypass cache pour les requêtes API (génération de phrases, etc.)
  if (shouldBypassCache(event.request.url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Stratégie cache-first pour les assets statiques
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match('./index.html');
      });
    })
  );
});
