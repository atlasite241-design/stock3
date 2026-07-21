'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

interface BIPEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Bannière d'installation PWA : bouton natif sur Android, instructions sur iOS. */
export default function InstallPrompt() {
  const { t } = useLanguage()
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Déjà installée (ouverte en mode standalone) → ne rien afficher.
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) return
    try { if (localStorage.getItem('dp_install_dismiss')) return } catch {}

    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua) && !/(crios|fxios|edgios)/i.test(ua)

    const onBIP = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BIPEvent)
      setShow(true)
    }
    const onInstalled = () => { setShow(false); try { localStorage.setItem('dp_install_dismiss', '1') } catch {} }

    window.addEventListener('beforeinstallprompt', onBIP)
    window.addEventListener('appinstalled', onInstalled)
    // iOS : pas d'événement d'installation → on affiche les instructions.
    if (isIOS) { setIos(true); setShow(true) }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!show) return null

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice.catch(() => null)
    if (choice?.outcome === 'accepted') setShow(false)
    setDeferred(null)
  }
  const dismiss = () => { setShow(false); try { localStorage.setItem('dp_install_dismiss', '1') } catch {} }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-2xl border border-amber-200 bg-white/95 p-3 shadow-2xl backdrop-blur dark:border-amber-500/25 dark:bg-[#12121a]/95">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/30">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-white">{t('install_title')}</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{ios ? t('install_ios') : t('install_desc')}</p>
        </div>
        {!ios && deferred && (
          <button onClick={install} className="btn-primary !h-9 shrink-0 text-xs">
            <Download className="h-3.5 w-3.5" />
            {t('install_btn')}
          </button>
        )}
        <button onClick={dismiss} aria-label="Fermer" className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:text-zinc-500 dark:hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
