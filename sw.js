const CACHE_NAME = 'kwakye-tech-current-ui-v1';
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.map(name => caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  if (event.request.method === 'GET' && event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
  }
});
