// Service worker — mode hors-ligne réel.
// Stratégie :
//  - Assets statiques Next (/_next/static, images, polices) : cache d'abord
//    (contenu immuable, hash dans l'URL), réseau en secours.
//  - Pages et payloads de navigation : réseau d'abord (données fraîches),
//    copie en cache à chaque succès → servies depuis le cache quand la
//    connexion est coupée. L'app est 100 % locale (localStorage), donc une
//    page servie du cache reste pleinement fonctionnelle hors-ligne.
//  - API (/api/*) et domaines externes (Turso…) : réseau uniquement — la
//    synchronisation gère elle-même sa file d'attente hors-ligne.

const CACHE = 'dp-cache-v2'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Turso & co : réseau direct
  if (url.pathname.startsWith('/api/')) return // API : réseau uniquement

  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?)$/.test(url.pathname)

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)

      if (isStatic) {
        // Cache d'abord — ces fichiers sont versionnés par leur URL.
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      }

      // Pages : réseau d'abord, cache en secours.
      try {
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      } catch {
        const hit = await cache.match(req)
        if (hit) return hit
        if (req.mode === 'navigate') {
          // Page jamais visitée hors-ligne → servir la coquille de l'app.
          const shell = (await cache.match('/')) || (await cache.match('/login'))
          if (shell) return shell
        }
        return new Response('Hors ligne — cette page n’a pas encore été visitée.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
    })()
  )
})
