'use client'

// Analyse des déclinaisons.
//
// Répond à une seule question : combien de vos fiches sont en réalité des
// TAILLES d'un même article ? Le calcul tourne sur le catalogue déjà chargé —
// aucune lecture Turso, conformément à la contrainte de quota.
//
// L'analyse est lancée à la demande : 86 000 désignations × 7 expressions
// régulières bloqueraient le fil principal si on la déclenchait au montage.

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Download, Layers, Play, Search } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { analyserDeclinaisons, type Analyse, type Famille } from '@/lib/variantes'
import { useDroguerie } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const PAGE = 60

const KIND_KEY: Record<string, TKey> = {
  dimensions: 'dv_k_dimensions',
  filetage: 'dv_k_filetage',
  diametre: 'dv_k_diametre',
  pouces: 'dv_k_pouces',
  mesure: 'dv_k_mesure',
  degre: 'dv_k_degre',
  taille: 'dv_k_taille',
}

const CONF_STYLE: Record<Famille['confiance'], string> = {
  haute: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  moyenne: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  a_verifier: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
}

function Content() {
  const { ready, products } = useDroguerie()
  const { t } = useLanguage()
  const [res, setRes] = useState<Analyse | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)

  if (!ready) return <Loader />

  const run = () => {
    setBusy(true)
    // Laisse le navigateur peindre l'état « en cours » avant de bloquer.
    setTimeout(() => {
      try {
        setRes(analyserDeclinaisons(products))
        setShown(PAGE)
      } finally {
        setBusy(false)
      }
    }, 30)
  }

  const confLabel = (c: Famille['confiance']) =>
    c === 'haute' ? t('dv_conf_high') : c === 'moyenne' ? t('dv_conf_mid') : t('dv_conf_check')

  const familles = res
    ? res.familles.filter((f) => {
        const q = query.trim().toLowerCase()
        return !q || f.modele.includes(q) || f.categories.some((c) => c.toLowerCase().includes(q))
      })
    : []

  const exportCsv = () => {
    if (!res) return
    const lines = [[t('dv_col_model'), t('sa_col_category'), t('dv_col_count'), t('dv_col_variants'), t('dv_col_conf')].join(';')]
    for (const f of res.familles) {
      lines.push([
        `"${f.modele}"`, `"${f.categories.join(' / ')}"`, f.membres.length,
        `"${f.membres.map((m) => m.declinaison).join(' | ')}"`,
        confLabel(f.confiance),
      ].join(';'))
    }
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'familles-declinaisons.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const pct = (n: number) => (res && res.total ? Math.round((n / res.total) * 100) : 0)

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Layers className="h-6 w-6 text-amber-500" />{t('dv_title')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">{t('dv_sub')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={run} disabled={busy} className="btn-primary disabled:opacity-40">
            <Play className="h-4 w-4" />{busy ? t('dv_running') : t('dv_run')}
          </button>
          {res && (
            <button onClick={exportCsv} className="btn-secondary"><Download className="h-4 w-4" />CSV</button>
          )}
        </div>
      </motion.div>

      {!res && !busy && (
        <div className="glass-card p-8 text-center">
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-zinc-300">{t('dv_intro')}</p>
          <p className="mx-auto mt-3 max-w-2xl text-xs text-gray-400 dark:text-zinc-500">{t('dv_intro_cost')}</p>
          <p className="mt-4 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
            {products.length.toLocaleString('fr-FR')} {t('dv_products_loaded')}
          </p>
        </div>
      )}

      {busy && <Loader />}

      {res && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { l: t('dv_kpi_total'), v: res.total.toLocaleString('fr-FR'), s: '' },
              { l: t('dv_kpi_families'), v: res.familles.length.toLocaleString('fr-FR'), s: t('dv_kpi_families_sub'), tone: 'text-amber-600 dark:text-amber-400' },
              { l: t('dv_kpi_grouped'), v: res.regroupables.toLocaleString('fr-FR'), s: `${pct(res.regroupables)} %`, tone: 'text-indigo-600 dark:text-indigo-400' },
              { l: t('dv_kpi_folded'), v: res.catalogueReplie.toLocaleString('fr-FR'), s: `${pct(res.catalogueReplie)} %`, tone: 'text-emerald-600 dark:text-emerald-400' },
            ].map((c, i) => (
              <div key={i} className="glass-card p-4">
                <p className={`text-2xl font-extrabold tabular-nums ${c.tone ?? 'text-gray-900 dark:text-white'}`}>{c.v}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{c.l}</p>
                {c.s && <p className="mt-0.5 text-[11px] tabular-nums text-gray-500 dark:text-zinc-400">{c.s}</p>}
              </div>
            ))}
          </div>

          <div className="glass-card p-5">
            <p className="text-sm font-bold text-gray-900 dark:text-white">{t('dv_verdict')}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-zinc-300">
              {res.total.toLocaleString('fr-FR')} {t('dv_verdict_a')}{' '}
              <b className="text-amber-600 dark:text-amber-400">{res.familles.length.toLocaleString('fr-FR')}</b>{' '}
              {t('dv_verdict_b')} <b>{res.isolees.toLocaleString('fr-FR')}</b> {t('dv_verdict_c')}{' '}
              <b className="text-emerald-600 dark:text-emerald-400">{res.catalogueReplie.toLocaleString('fr-FR')}</b>{' '}
              {t('dv_verdict_d')}
            </p>
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              <div className="h-full bg-amber-500" style={{ width: `${pct(res.regroupables)}%` }} title={t('dv_kpi_grouped')} />
              <div className="h-full bg-gray-300 dark:bg-white/20" style={{ width: `${pct(res.isolees)}%` }} title={t('dv_isolated')} />
            </div>
            <p className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-gray-500 dark:text-zinc-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500" />{t('dv_kpi_grouped')}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-300 dark:bg-white/20" />{t('dv_isolated')}</span>
            </p>

            {/* Pourquoi une fiche reste isolée : la réponse dit s'il faut
                améliorer la détection ou accepter le résultat. */}
            <div className="mt-3 grid gap-2 border-t border-gray-100 pt-3 sm:grid-cols-2 dark:border-white/10">
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                <b className="tabular-nums text-gray-900 dark:text-white">{res.isoleesSansDimension.toLocaleString('fr-FR')}</b>{' '}
                {t('dv_iso_nodim')}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                <b className="tabular-nums text-gray-900 dark:text-white">{res.isoleesModeleUnique.toLocaleString('fr-FR')}</b>{' '}
                {t('dv_iso_alone')}
              </p>
            </div>
          </div>

          {res.parKind.length > 0 && (
            <div className="glass-card overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                    <th className="px-4 py-3">{t('dv_col_kind')}</th>
                    <th className="px-4 py-3 text-center">{t('dv_kpi_families')}</th>
                    <th className="px-4 py-3 text-center">{t('dv_col_records')}</th>
                    <th className="px-4 py-3">{t('rp_vd_share')}</th>
                  </tr>
                </thead>
                <tbody>
                  {res.parKind.map((k) => (
                    <tr key={k.kind} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                      <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">
                        {KIND_KEY[k.kind] ? t(KIND_KEY[k.kind]) : k.kind}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{k.familles.toLocaleString('fr-FR')}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{k.fiches.toLocaleString('fr-FR')}</td>
                      <td className="px-4 py-2.5">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${res.parKind[0].fiches ? Math.round((k.fiches / res.parKind[0].fiches) * 100) : 0}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="glass-card flex flex-wrap items-center gap-3 p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 rtl:left-auto rtl:right-3" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShown(PAGE) }}
                placeholder={t('dv_search')}
                className="input-field pl-9 rtl:pl-3 rtl:pr-9"
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-gray-500 dark:text-zinc-400">
              {familles.length.toLocaleString('fr-FR')}
            </span>
          </div>

          <div className="space-y-2">
            {familles.slice(0, shown).map((f) => (
              <div key={f.id} className="glass-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{f.modele}</p>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500">
                      {f.categories.join(' / ') || '—'}
                      {f.marques.length ? ` · ${f.marques.join(' / ')}` : ''}
                      {(f.categories.length > 1 || f.marques.length > 1) && (
                        <span className="ml-1 text-amber-600 dark:text-amber-400">{t('dv_diverge')}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {f.collisions > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="h-3.5 w-3.5" />{f.collisions} {t('dv_collisions')}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CONF_STYLE[f.confiance]}`}>
                      {confLabel(f.confiance)}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-gray-600 dark:bg-white/10 dark:text-zinc-300">
                      {f.membres.length}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {f.membres.slice(0, 24).map((m) => (
                    <span key={m.id} title={m.name}
                      className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                      {m.declinaison}
                    </span>
                  ))}
                  {f.membres.length > 24 && (
                    <span className="px-1.5 py-0.5 text-[11px] text-gray-400">+{f.membres.length - 24}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {familles.length > shown && (
            <div className="flex justify-center">
              <button onClick={() => setShown((n) => n + PAGE * 3)} className="btn-secondary">
                {shown.toLocaleString('fr-FR')} / {familles.length.toLocaleString('fr-FR')} — {t('rpst_more')}
              </button>
            </div>
          )}

          <p className="rounded-xl border border-dashed border-gray-200 p-3 text-[11px] leading-relaxed text-gray-500 dark:border-white/15 dark:text-zinc-400">
            {t('dv_disclaimer')}
          </p>
        </>
      )}
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
