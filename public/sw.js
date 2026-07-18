// Service worker minimal — présent surtout pour rendre l'app "installable" (PWA).
// Stratégie volontairement simple (réseau d'abord) : l'app est dynamique
// (localStorage + Turso), on évite tout cache agressif qui servirait des
// données périmées.

const VERSION = 'v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  // On ne touche qu'aux navigations GET ; le reste passe direct au réseau.
  if (req.method !== 'GET') return
  event.respondWith(fetch(req).catch(() => caches.match(req)))
})
