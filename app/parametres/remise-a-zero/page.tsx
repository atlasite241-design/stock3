'use client'

// Remise à zéro des données métier (phase de test).
//
// Deux temps volontairement séparés : on EXPORTE d'abord, on efface ensuite.
// L'effacement porte sur le SERVEUR puis sur le poste — vider seulement le
// local ne servirait à rien, la synchro rapatrierait tout aussitôt.

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Database, Download, Loader2, ShieldAlert, Trash2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import DangerConfirm from '@/components/DangerConfirm'
import Loader from '@/components/Loader'
import { useToast } from '@/components/Toast'
import { apiAll } from '@/lib/sync-api'
import { resetDemoData, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const KEPT = ['users', 'stores', 'settings']

function Content() {
  const { ready } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [busy, setBusy] = useState<'export' | 'reset' | null>(null)
  const [exported, setExported] = useState<number | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  if (!ready) return <Loader />

  /** Télécharge l'intégralité du contenu distant, page par page. */
  const exportAll = async () => {
    setBusy('export')
    try {
      const rows: unknown[] = []
      let after = 0
      for (let page = 0; page < 5000; page++) {
        const res = await apiAll(after)
        rows.push(...res.rows)
        if (res.scanned < res.page) break
        after = res.cursor
      }
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), rows }, null, 1)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sauvegarde-complete-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExported(rows.length)
      toast(`✓ ${rows.length.toLocaleString('fr-FR')} ${t('rz_exported')}`)
    } catch {
      toast(t('rz_export_failed'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const doReset = async () => {
    setConfirm(false)
    setBusy('reset')
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'EFFACER' }),
        credentials: 'same-origin',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) { toast(json.error === 'forbidden' ? t('rz_forbidden') : t('rz_failed'), 'error'); return }

      setDone(json.deleted ?? 0)
      // Le poste doit oublier ce qu'il détenait, sinon il repousserait tout.
      resetDemoData()
      try { localStorage.removeItem('dp_sync_cursor') } catch {}
      setTimeout(() => window.location.replace('/'), 1400)
    } catch {
      toast(t('rz_failed'), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <Database className="h-6 w-6 text-rose-500" />{t('rz_title')}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">{t('rz_sub')}</p>
      </motion.div>

      {/* Étape 1 — export */}
      <section className="glass-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-zinc-100">
          <Download className="h-4 w-4 text-emerald-500" />{t('rz_step1')}
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{t('rz_step1_d')}</p>
        <button onClick={exportAll} disabled={busy !== null} className="btn-secondary mt-3 disabled:opacity-40">
          {busy === 'export' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t('rz_export')}
        </button>
        {exported !== null && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />{exported.toLocaleString('fr-FR')} {t('rz_exported')}
          </p>
        )}
      </section>

      {/* Étape 2 — effacement */}
      <section className="rounded-2xl border-2 border-rose-200 bg-rose-50/40 p-5 dark:border-rose-500/25 dark:bg-rose-500/[0.06]">
        <h2 className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-400">
          <ShieldAlert className="h-4 w-4" />{t('rz_step2')}
        </h2>
        <p className="mt-1 text-xs text-gray-600 dark:text-zinc-300">{t('rz_step2_d')}</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">{t('rz_kept')}</p>
            <p className="mt-1 text-xs text-gray-700 dark:text-zinc-300">{t('rz_kept_list')}</p>
            <p className="mt-1 font-mono text-[10px] text-gray-500">{KEPT.join(' · ')}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-white/60 p-3 dark:border-rose-500/20 dark:bg-white/5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-400">{t('rz_wiped')}</p>
            <p className="mt-1 text-xs text-gray-700 dark:text-zinc-300">{t('rz_wiped_list')}</p>
          </div>
        </div>

        <button onClick={() => setConfirm(true)} disabled={busy !== null || done !== null}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-40">
          {busy === 'reset' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {t('rz_action')}
        </button>

        {done !== null && (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />{done.toLocaleString('fr-FR')} {t('rz_done')}
          </p>
        )}
      </section>

      <DangerConfirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={doReset}
        title={t('rz_confirm_title')}
        description={t('rz_confirm_desc')}
        word="EFFACER"
        actionLabel={t('rz_action')}
      />
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
