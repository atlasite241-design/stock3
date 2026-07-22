'use client'

import { useEffect, useRef, useState } from 'react'
import { Store } from 'lucide-react'
import { useDroguerie } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { useLanguage } from '@/lib/i18n'

/** Écran de démarrage affiché APRÈS l'identification (entrée dans l'app), le temps que
 *  les données soient prêtes. Masque le figement et donne une entrée soignée. */
export default function BootSplash() {
  const { ready } = useDroguerie()
  const { currentUser } = useAuth()
  const { t } = useLanguage()
  const authed = !!currentUser
  const [visible, setVisible] = useState(false)
  const [minElapsed, setMinElapsed] = useState(false)
  const startedRef = useRef(false)

  // Déclenche le splash au moment de l'identification (et réarme après déconnexion).
  useEffect(() => {
    if (!authed) { startedRef.current = false; setVisible(false); return }
    if (startedRef.current) return
    startedRef.current = true
    setVisible(true)
    setMinElapsed(false)
    const tm = setTimeout(() => setMinElapsed(true), 1400)
    return () => clearTimeout(tm)
  }, [authed])

  // Retire le splash quand les données sont prêtes ET la durée mini écoulée.
  useEffect(() => {
    if (!visible || !ready || !minElapsed) return
    const tm = setTimeout(() => setVisible(false), 550)
    return () => clearTimeout(tm)
  }, [visible, ready, minElapsed])

  if (!visible) return null
  const leaving = ready && minElapsed

  return (
    <div
      aria-hidden
      style={{ opacity: leaving ? 0 : 1, pointerEvents: leaving ? 'none' : 'auto', transition: 'opacity .55s ease' }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#080a12]"
    >
      {/* Halo ambiant */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/10 blur-[130px]" />
      </div>

      {/* Icône */}
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-[22px] bg-gradient-to-br from-amber-400 to-yellow-500 shadow-2xl shadow-amber-500/40">
          <Store className="h-10 w-10 text-[#3a2b06]" strokeWidth={2.2} />
        </div>
        <span className="absolute -right-1 -top-1 h-5 w-5 rounded-full border-[3px] border-[#080a12] bg-emerald-400" />
      </div>

      {/* Titre */}
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
        Droguerie{' '}
        <span className="bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">Pro</span>
      </h1>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-zinc-500">Édition Professionnelle</p>

      {/* Barre de progression indéterminée */}
      <div className="mt-10 h-1 w-56 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500" style={{ animation: 'splashSlide 1.15s ease-in-out infinite' }} />
      </div>
      <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-600" style={{ animation: 'splashPulse 1.6s ease-in-out infinite' }}>
        {t('splash_init')}
      </p>
    </div>
  )
}
