'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Camera, ScanLine } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import CameraScanner from '@/components/CameraScanner'
import { useToast } from '@/components/Toast'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

// Normalisation d'une réf de bon pour la recherche au scan : minuscules et sans
// séparateurs. Une douchette sur clavier français peut rendre les « - » autrement
// (ex. « ß »), donc on compare en ignorant tout ce qui n'est pas alphanumérique.
const normRef = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function Content() {
  const { ready, bons } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Index réf → bon (recherche indexée, pas de scan linéaire).
  const byRef = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of bons) m.set(normRef(b.ref), b.id)
    return m
  }, [bons])

  useEffect(() => { if (ready) inputRef.current?.focus() }, [ready])

  const resolve = (raw: string) => {
    const c = normRef(raw)
    if (!c) return
    const id = byRef.get(c)
    if (!id) { toast(`${t('bon_scan_not_found')} : ${raw.trim()}`, 'error'); setCode(''); return }
    // On ouvre directement la saisie : le contrôle « déjà saisi » y est fait.
    router.push(`/ventes/bons/saisie?id=${id}`)
  }

  if (!ready) return <Loader />

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <ScanLine className="h-6 w-6 text-amber-500" />{t('bon_scan_title')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('bon_scan_sub')}</p>
      </motion.div>

      <div className="glass-card mx-auto max-w-xl space-y-4 p-6">
        <div className="relative">
          <ScanLine className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-amber-500" />
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') resolve(code) }}
            placeholder={t('bon_scan_placeholder')}
            autoComplete="off"
            className="input-field h-16 pl-14 text-center font-mono text-xl"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => resolve(code)} className="btn-primary h-14 flex-1 text-base font-bold">
            <ScanLine className="h-5 w-5" />{t('bon_scan_bon_btn')}
          </button>
          <button onClick={() => setCameraOpen(true)} className="btn-secondary h-14 shrink-0 px-5">
            <Camera className="h-5 w-5" />
          </button>
        </div>
      </div>

      <CameraScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onDetect={(c) => { setCameraOpen(false); resolve(c) }} />
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
