/* Service Worker — «Смена» — офлайн-доступ к приложению первой помощи.
 *
 * Стратегия: stale-while-revalidate.
 *  - Если файл уже в кэше — отдаём его СРАЗУ (мгновенная загрузка, работает без сети).
 *  - Параллельно в фоне пытаемся скачать свежую версию и кладём её в кэш —
 *    в следующий раз (когда снова будет сеть) пользователь получит обновлённые протоколы.
 *  - Если сети нет и в кэше ничего нет (самый первый запуск без интернета) — запрос просто падает,
 *    как обычно при отсутствии сети.
 *
 * ВАЖНО: при каждом обновлении index.html увеличивайте номер версии ниже (v1 -> v2 -> ...).
 * Это не обязательно для получения самого свежего содержимого (см. стратегию выше),
 * но полезно, если нужно принудительно очистить старый кэш целиком.
 */

const CACHE_NAME = 'smena-cache-v1';

// Файлы, которые нужно закэшировать сразу при установке SW.
// Указываем несколько вариантов пути, чтобы совпасть с тем, как именно открыта страница.
const PRECACHE_URLS = [
  './',
  './index.html'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function () {
            // Один из путей мог не совпасть (например, нет index.html в этой директории) — не страшно.
          });
        })
      );
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) { return name !== CACHE_NAME; })
          .map(function (name) { return caches.delete(name); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  // Кэшируем только GET-запросы к нашей же странице (навигацию и сам HTML).
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(event.request).then(function (cached) {
        const networkFetch = fetch(event.request).then(function (response) {
          if (response && response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(function () {
          // Сети нет — если есть что-то в кэше, используем его, иначе даём запросу упасть как обычно.
          return cached;
        });

        // Если уже что-то закэшировано — отдаём это немедленно, не дожидаясь сети.
        return cached || networkFetch;
      });
    })
  );
});
