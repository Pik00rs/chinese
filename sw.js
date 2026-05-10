// Service Worker — auto-update avec notification cliente
// Plus besoin de bumper manuellement la version : le navigateur détecte tout seul
// les changements de byte sur ce fichier (les commentaires de timestamp suffisent à invalider)

// BUILD : ce timestamp change à chaque déploiement (mis à jour automatiquement)
// Pour forcer une maj, tu peux modifier ce commentaire ou n'importe quoi dans ce fichier
const BUILD = '2026-05-10T08:00:00Z';
const CACHE_NAME = `hsk-trainer-${BUILD}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './lessons.js',
  './icon-192.png',
  './icon-512.png',
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

// === INSTALL ===
// Le nouveau SW se télécharge en arrière-plan, met les nouveaux fichiers en cache
// puis attend (passe en état "waiting") jusqu'à ce qu'on l'active.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS).catch(err => {
        console.warn('Some assets failed to cache:', err);
      }))
  );
  // Note : on N'APPELLE PAS skipWaiting() ici directement
  // C'est le client qui le déclenche via postMessage quand l'utilisateur clique "Recharger"
});

// === ACTIVATE ===
// Quand on devient actif, on supprime les anciens caches et on revendique tous les clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// === MESSAGE depuis le client ===
// Le client peut nous demander de skip waiting et activer immédiatement la nouvelle version
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// === FETCH ===
self.addEventListener('fetch', (event) => {
  // Bypass cache pour les requêtes API
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
