'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Download, KeyRound, Loader2, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/auth-context'
import { generateKeys, getLicenseStats, type LicenseStat } from '@/lib/license'
import { useLanguage } from '@/lib/i18n'

const DURATIONS = [1, 3, 6, 12]

function Content() {
  const { session } = useAuth()
  const { t } = useLanguage()
  const toast = useToast()

  const [stats, setStats] = useState<LicenseStat[] | null>(null)
  const [months, setMonths] = useState('12')
  const [count, setCount] = useState('50')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const isAdmin = session?.role === 'Administrateur'

  const loadStats = async () => {
    try {
      setStats(await getLicenseStats())
    } catch {
      toast(t('lca_error'), 'error')
    }
  }

  useEffect(() => {
    if (isAdmin) loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500"><ShieldAlert className="h-7 w-7" /></span>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('lca_title')}</h1>
          <p className="text-sm text-rose-500">{t('rst_forbidden')}</p>
        </div>
      </div>
    )
  }

  const countFor = (m: number) => stats?.find((s) => s.months === m)?.count ?? 0
  const total = stats?.reduce((a, s) => a + s.count, 0) ?? 0

  const generate = async () => {
    setGenerating(true)
    setGenerated([])
    try {
      const keys = await generateKeys(parseInt(months, 10), Math.max(1, Math.min(500, parseInt(count, 10) || 0)))
      setGenerated(keys)
      await loadStats()
      toast(`✓ ${keys.length} ${t('lca_generated')}`)
    } catch {
      toast(t('lca_error'), 'error')
    } finally {
      setGenerating(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(generated.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const download = () => {
    const blob = new Blob([generated.map((k) => `${months} mois\t${k}`).join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `licences-${months}mois-${generated.length}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400"><KeyRound className="h-6 w-6" /></span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('lca_title')}</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">{t('lca_subtitle')}</p>
          </div>
        </div>
        <button onClick={loadStats} className="btn-secondary !h-9 text-xs"><RefreshCw className="h-3.5 w-3.5" />{t('lca_refresh')}</button>
      </motion.div>

      {/* Remaining keys */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('lca_remaining')} · {t('lca_total')} {total}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DURATIONS.map((m) => (
            <div key={m} className="glass-card p-4 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">{m} {t('lca_months_unit')}</p>
              <p className="mt-1 text-2xl font-black text-gray-900 dark:text-white tabular-nums">{stats === null ? '…' : countFor(m)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Generate */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"><Sparkles className="h-5 w-5 text-amber-500" />{t('lca_generate_title')}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="field-label">{t('lca_duration')}</label>
            <Select value={months} onChange={setMonths} options={DURATIONS.map((m) => ({ value: String(m), label: `${m} ${t('lca_months_unit')}` }))} />
          </div>
          <div>
            <label className="field-label">{t('lca_count')}</label>
            <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(e.target.value)} className="input-field" />
          </div>
          <div className="flex items-end">
            <button onClick={generate} disabled={generating} className="btn-primary w-full disabled:opacity-50">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {generating ? t('lca_generating') : t('lca_generate')}
            </button>
          </div>
        </div>

        {generated.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{generated.length} {t('lca_generated')} · {months} {t('lca_months_unit')}</p>
              <div className="flex gap-2">
                <button onClick={copy} className="btn-secondary !h-8 !px-3 text-xs"><Copy className="h-3.5 w-3.5" />{copied ? t('lca_copied') : t('lca_copy')}</button>
                <button onClick={download} className="btn-secondary !h-8 !px-3 text-xs"><Download className="h-3.5 w-3.5" />{t('lca_download')}</button>
              </div>
            </div>
            <textarea
              readOnly
              value={generated.join('\n')}
              rows={8}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-800 dark:border-white/10 dark:bg-black/40 dark:text-zinc-200"
            />
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default function LicencesPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
