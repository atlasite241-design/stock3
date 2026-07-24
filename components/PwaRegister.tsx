'use client'

import { useEffect } from 'react'

// Enregistre le service worker (nécessaire pour l'installation PWA).
// Composant sans rendu : il agit uniquement au montage, côté client.
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Échec silencieux : l'app fonctionne sans le SW, il n'est utile
        // que pour l'installation et le repli hors-ligne.
      })
    }
    window.addEventListener('load', onLoad)

    // Filet de sécurité : après un déploiement, une navigation client peut
    // demander un « chunk » JS dont le hash a changé et échouer (« This page
    // couldn't load »). On recharge alors la page UNE fois pour récupérer la
    // nouvelle version, sans boucle (drapeau en sessionStorage).
    const isChunkError = (msg: string) =>
      /ChunkLoadError|Loading chunk|Loading CSS chunk|Importing a module script failed|error loading dynamically imported module/i.test(msg)
    const recover = (msg: string) => {
      if (!isChunkError(msg)) return
      if (sessionStorage.getItem('dp_chunk_reloaded')) return
      sessionStorage.setItem('dp_chunk_reloaded', '1')
      window.location.reload()
    }
    const onError = (e: ErrorEvent) => recover(e.message || '')
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason
      recover(typeof r === 'string' ? r : r?.message || r?.name || '')
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    // Si l'app tourne 8 s sans incident, le rechargement a réussi : on réarme le
    // drapeau pour qu'un futur incident (prochain déploiement) puisse rejouer une
    // fois. Sans ce délai, un même mount pourrait boucler indéfiniment.
    const clr = setTimeout(() => sessionStorage.removeItem('dp_chunk_reloaded'), 8000)

    return () => {
      clearTimeout(clr)
      window.removeEventListener('load', onLoad)
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
