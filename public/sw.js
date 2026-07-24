// Service worker — mode hors-ligne réel.
// Stratégie :
//  - Assets statiques Next (/_next/static, images, polices) : cache d'abord
//    (contenu immuable, hash dans l'URL), réseau en secours.
//  - Pages et payloads de navigation : réseau d'abord (données fraîches),
//    copie en cache à chaque succès → servies depuis le cache quand la
//    connexion est coupée. L'app est 100 % locale, donc une page servie du
//    cache reste pleinement fonctionnelle hors-ligne.
//  - API (/api/*) et domaines externes (Turso…) : réseau uniquement — la
//    synchronisation gère elle-même sa file d'attente hors-ligne.
//
// IMPORTANT : le handler ne doit JAMAIS faire échouer une navigation. Toute
// erreur interne (ex. cache.put refuse une réponse redirigée de Next.js, ce qui
// provoquait l'écran « This page couldn't load ») est rattrapée et on se rabat
// sur le réseau direct.

const CACHE = 'dp-cache-v3'

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

// Une réponse n'est mise en cache que si elle est sûre à rejouer : même origine,
// statut 200, non redirigée, type exploitable. cache.put() lève sinon une
// exception (réponse « opaqueredirect », partielle…) qui casserait la requête.
function isCacheable(res) {
  return res && res.ok && res.status === 200 && !res.redirected && res.type !== 'opaqueredirect'
}

async function safePut(cache, req, res) {
  if (!isCacheable(res)) return
  try {
    await cache.put(req, res.clone())
  } catch {
    /* réponse non cacheable : on ignore, sans jamais casser la navigation */
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return // Turso & co : réseau direct
  if (url.pathname.startsWith('/api/')) return // API : réseau uniquement

  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?)$/.test(url.pathname)

  event.respondWith(
    (async () => {
      let cache
      try {
        cache = await caches.open(CACHE)
      } catch {
        return fetch(req) // stockage indisponible → réseau direct
      }

      if (isStatic) {
        // Cache d'abord — ces fichiers sont versionnés par leur URL.
        try {
          const hit = await cache.match(req)
          if (hit) return hit
        } catch {
          /* ignore */
        }
        try {
          const res = await fetch(req)
          await safePut(cache, req, res)
          return res
        } catch {
          const hit = await cache.match(req).catch(() => undefined)
          if (hit) return hit
          throw new Error('offline-static')
        }
      }

      // Pages : réseau d'abord, cache en secours.
      try {
        const res = await fetch(req)
        await safePut(cache, req, res)
        return res
      } catch {
        const hit = await cache.match(req).catch(() => undefined)
        if (hit) return hit
        if (req.mode === 'navigate') {
          const shell =
            (await cache.match('/').catch(() => undefined)) ||
            (await cache.match('/login').catch(() => undefined))
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
