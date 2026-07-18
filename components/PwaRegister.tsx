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
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return null
}
