/* eslint-env serviceworker */
 

const STATIC_CACHE = 'portfolio-static-v1'
const DYNAMIC_CACHE = 'portfolio-dynamic-v1'

// Ressources à mettre en cache immédiatement
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  // Ajoutez d'autres ressources statiques critiques ici
]

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...')
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Service Worker: Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('Service Worker: Installed successfully')
        return self.skipWaiting()
      })
      .catch(error => {
        console.error('Service Worker: Installation failed', error)
      })
  )
})

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...')
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Supprimer les anciens caches
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('Service Worker: Activated successfully')
        return self.clients.claim()
      })
  )
})

// Stratégie de cache
self.addEventListener('fetch', (event) => {
  const { request } = event
  
  // Ignorer les requêtes non-HTTP
  if (!request.url.startsWith('http')) return
  
  // Ne pas intercepter les requêtes externes - laisser le navigateur les gérer directement
  if (request.url.includes('fonts.googleapis.com') || 
      request.url.includes('fonts.gstatic.com') ||
      request.url.includes('reasonlabsapi.com') || 
      request.url.includes('ab.reasonlabsapi.com')) {
    // Ne pas intercepter du tout ces requêtes
    return
  }
  
  // Stratégie Cache First pour les assets statiques (incluant les images)
  if (request.url.includes('/assets/') || 
      request.url.includes('/images/') ||
      request.url.includes('.css') || 
      request.url.includes('.js') ||
      request.url.includes('.woff') ||
      request.url.includes('.woff2') ||
      request.url.includes('.webp') ||
      request.url.includes('.jpg') ||
      request.url.includes('.jpeg') ||
      request.url.includes('.png') ||
      request.url.includes('.svg')) {
    
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            return response
          }
          
          return fetch(request)
            .then(fetchResponse => {
              // Cloner la réponse car elle ne peut être utilisée qu'une fois
              const responseClone = fetchResponse.clone()
              
              caches.open(STATIC_CACHE)
                .then(cache => {
                  cache.put(request, responseClone)
                })
              
              return fetchResponse
            })
        })
        .catch(() => {
          // Fallback en cas d'échec
          if (request.destination === 'document') {
            return caches.match('/')
          }
        })
    )
    return
  }
  
  // Stratégie Network First pour les pages et API
  if (request.destination === 'document' || request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cloner et mettre en cache la réponse
          const responseClone = response.clone()
          
          caches.open(DYNAMIC_CACHE)
            .then(cache => {
              cache.put(request, responseClone)
            })
          
          return response
        })
        .catch(() => {
          // Fallback vers le cache
          return caches.match(request)
            .then(response => {
              if (response) {
                return response
              }
              
              // Fallback vers la page d'accueil pour les routes SPA
              if (request.destination === 'document') {
                return caches.match('/')
              }
              
              // Réponse d'erreur générique
              return new Response('Contenu indisponible hors ligne', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/plain'
                })
              })
            })
        })
    )
    return
  }
  
  // Stratégie par défaut : passer la requête
  event.respondWith(fetch(request))
})

// Gestion des messages du client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urlsToCache = event.data.payload
    
    caches.open(DYNAMIC_CACHE)
      .then(cache => {
        return cache.addAll(urlsToCache)
      })
      .then(() => {
        event.ports[0].postMessage({ success: true })
      })
      .catch(error => {
        console.error('Service Worker: Error caching URLs', error)
        event.ports[0].postMessage({ success: false, error })
      })
  }
})

// Nettoyage périodique du cache
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE)
        .then(cache => {
          return cache.keys()
        })
        .then(keys => {
          // Garder seulement les 50 dernières entrées
          if (keys.length > 50) {
            const keysToDelete = keys.slice(0, keys.length - 50)
            return Promise.all(
              keysToDelete.map(key => 
                caches.open(DYNAMIC_CACHE).then(cache => cache.delete(key))
              )
            )
          }
        })
    )
  }
})
