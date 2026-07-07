/* Service Worker: «Поезд Смена» — офлайн-кэш приложения.
   Стратегия: сначала кэш (мгновенно + работает без сети),
   в фоне тихо обновляет кэш из сети, если она есть. */

const CACHE_NAME = 'smena-cache-v3';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // внешние ресурсы (шрифты) — как обычно, через сеть

  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
