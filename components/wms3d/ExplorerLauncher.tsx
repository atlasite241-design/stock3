'use client'

// Lanceur de l'explorateur 3D — protège la page contre un crash NATIF du
// renderer (« This page couldn't load »), qu'aucun ErrorBoundary ne peut
// intercepter : sur certains GPU/drivers anciens, three.js tue l'onglet.
//
// Principe :
//  1. three.js n'est PAS importé au chargement de la page (import dynamique
//     déclenché seulement au montage de <Explorer3D>), donc la page reste
//     saine même si le module fait tomber le renderer.
//  2. Un témoin (localStorage) est posé AVANT de lancer la 3D et retiré une
//     fois le rendu réussi. S'il est encore là au retour, c'est que la
//     tentative précédente a crashé → on n'auto-lance plus et on propose
//     les vues 2D équivalentes.

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { AlertTriangle, BarChart3, Map, Play, Rotate3d } from 'lucide-react'
import Loader from '@/components/Loader'
import { useLanguage } from '@/lib/i18n'

const Explorer3D = dynamic(() => import('./Explorer3D'), { ssr: false, loading: () => <Loader /> })

// Le suffixe est versionné : après un correctif du moteur 3D, les témoins
// laissés par l'ancienne version ne doivent plus bloquer le lancement.
const FLAG = 'dp_x3_crash_r19'
const shellClass =
  'relative flex h-[calc(100dvh-180px)] min-h-[480px] flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0b0b12] to-[#12121d] p-8 text-center shadow-2xl'

export default function ExplorerLauncher({ initialCode }: { initialCode?: string }) {
  const { t } = useLanguage()
  // 'check' → lecture du témoin ; 'idle' → crash précédent, attente d'un clic ;
  // 'run' → 3D montée.
  const [phase, setPhase] = useState<'check' | 'idle' | 'run'>('check')

  useEffect(() => {
    let crashed = false
    try { crashed = localStorage.getItem(FLAG) === '1' } catch {}
    if (crashed) { setPhase('idle'); return }
    try { localStorage.setItem(FLAG, '1') } catch {}
    setPhase('run')
  }, [])

  // Rendu réussi : on retire le témoin (la 3D fonctionne sur cette machine).
  const onReady = useCallback(() => {
    setTimeout(() => { try { localStorage.removeItem(FLAG) } catch {} }, 2500)
  }, [])

  const launch = () => {
    try { localStorage.setItem(FLAG, '1') } catch {}
    setPhase('run')
  }

  if (phase === 'check') return <div className={shellClass}><Loader /></div>

  if (phase === 'idle') {
    return (
      <div className={shellClass}>
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <h2 className="text-lg font-bold text-white">{t('x3_crash_title')}</h2>
        <p className="max-w-lg text-sm leading-relaxed text-zinc-400">{t('x3_crash_desc')}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <button onClick={launch} className="btn-primary"><Play className="h-4 w-4" />{t('x3_crash_retry')}</button>
          <Link href="/magasins/plan" className="btn-secondary"><Map className="h-4 w-4" />{t('x3_open_plan')}</Link>
          <Link href="/magasins/rapports" className="btn-secondary"><BarChart3 className="h-4 w-4" />{t('x3_open_reports')}</Link>
        </div>
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-[11px] text-zinc-500">
          <Rotate3d className="h-3.5 w-3.5" />{t('x3_gpu_hint')}
        </p>
      </div>
    )
  }

  return <Explorer3D initialCode={initialCode} onReady={onReady} />
}
