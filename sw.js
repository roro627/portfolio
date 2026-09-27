// Retire legacy portfolio caches so visitors receive the current public content.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter(name => /^portfolio-(static|dynamic)-/.test(name)).map(name => caches.delete(name)))
    await self.clients.claim()
    await self.registration.unregister()
  })())
})
