/* Service Worker Journal React
 *
 * Стратегии:
 *  - навигация (HTML): сеть → при офлайне кеш → /index.html;
 *  - статика того же происхождения (js/css/иконки/манифест): cache-first,
 *    свежая версия подкачивается в фоне (stale-while-revalidate);
 *  - /api/* и любые кросс-доменные запросы (fs.top-academy.ru, s3) —
 *    ТОЛЬКО сеть: API-ответы не кешируем, чтобы не показывать чужие оценки.
 */
const VERSION = 'journal-v1'
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // API и внешние файловые сервисы — только сеть
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return

  // Навигация: сеть, при офлайне — кеш страницы
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(VERSION).then((c) => c.put('/index.html', copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Статика: из кеша мгновенно, свежая версия — в фон
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
