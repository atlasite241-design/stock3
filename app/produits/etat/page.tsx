'use client'

// État du catalogue : par quoi commencer.
//
// L'écran répond à une seule question — quelle part du catalogue est réellement
// utilisable au comptoir — et donne la liste de travail triée par ce qui se vend.
// Calcul local, à la demande : aucune lecture de la base distante.

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, ClipboardList, Download, Play, Scale, Stethoscope } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { etatCatalogue, type CritereId, type EtatCatalogue } from '@/lib/catalogue-sante'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const PAGE = 50

const LABEL: Record<CritereId, TKey> = {
  prix_vente: 'ec_c_prix_vente',
  prix_achat: 'ec_c_prix_achat',
  marge: 'ec_c_marge',
  code_barres: 'ec_c_code_barres',
  emplacement: 'ec_c_emplacement',
  categorie: 'ec_c_categorie',
  seuil: 'ec_c_seuil',
  stock_sain: 'ec_c_stock_sain',
}

const FIX: Partial<Record<CritereId, { href: string; key: TKey }>> = {
  emplacement: { href: '/magasins/affectation', key: 'ec_f_emplacement' },
  code_barres: { href: '/produits/codes-barres', key: 'ec_f_code_barres' },
  categorie: { href: '/produits/categories', key: 'ec_f_categorie' },
  seuil: { href: '/stock/critique', key: 'ec_f_seuil' },
  stock_sain: { href: '/stock/controle/negatif', key: 'ec_f_stock_sain' },
}

const GRAVITE_STYLE = {
  bloquant: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  important: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  confort: 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-zinc-400',
} as const

function Content() {
  const { ready, products, sales } = useDroguerie()
  const { t } = useLanguage()
  const [res, setRes] = useState<EtatCatalogue | null>(null)
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState(PAGE)

  if (!ready) return <Loader />

  const run = () => {
    setBusy(true)
    setTimeout(() => {
      try {
        setRes(etatCatalogue(products, sales))
        setShown(PAGE)
      } finally {
        setBusy(false)
      }
    }, 30)
  }

  const gravLabel = (g: 'bloquant' | 'important' | 'confort') =>
    g === 'bloquant' ? t('ec_g_blocking') : g === 'important' ? t('ec_g_important') : t('ec_g_comfort')

  const exportCsv = () => {
    if (!res) return
    const head = [t('sa_col_product'), t('dv_col_count'), t('cp_col_amount'), t('ec_col_missing')].join(';')
    const lines = res.chantier.map((c) =>
      [`"${c.name}"`, c.ventes, c.valeur.toFixed(2), `"${c.manques.map((m) => t(LABEL[m])).join(' | ')}"`].join(';')
    )
    const url = URL.createObjectURL(new Blob(['﻿' + [head, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'chantier-catalogue.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Stethoscope className="h-6 w-6 text-amber-500" />{t('ec_title')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">{t('ec_sub')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={run} disabled={busy} className="btn-primary disabled:opacity-40">
            <Play className="h-4 w-4" />{busy ? t('dv_running') : t('ec_run')}
          </button>
          {res && <button onClick={exportCsv} className="btn-secondary"><Download className="h-4 w-4" />CSV</button>}
        </div>
      </motion.div>

      {!res && !busy && (
        <div className="glass-card p-8 text-center">
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-zinc-300">{t('ec_intro')}</p>
          <p className="mx-auto mt-3 max-w-2xl text-xs text-gray-400 dark:text-zinc-500">{t('dv_intro_cost')}</p>
        </div>
      )}

      {busy && <Loader />}

      {res && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass-card p-4">
              <p className={`text-3xl font-extrabold tabular-nums ${res.scoreComptoir >= 90 ? 'text-emerald-600 dark:text-emerald-400' : res.scoreComptoir >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {res.scoreComptoir} %
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('ec_kpi_counter')}</p>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-zinc-400">{t('ec_kpi_counter_sub')}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-3xl font-extrabold tabular-nums text-gray-900 dark:text-white">{res.scoreComplet} %</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('ec_kpi_full')}</p>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-zinc-400">{t('ec_kpi_full_sub')}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-3xl font-extrabold tabular-nums text-indigo-600 dark:text-indigo-400">{res.actifs.toLocaleString('fr-FR')}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('ec_kpi_active')}</p>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-zinc-400">{t('ec_kpi_active_sub')}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-3xl font-extrabold tabular-nums text-gray-400 dark:text-zinc-500">{res.dormants.toLocaleString('fr-FR')}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('ec_kpi_dormant')}</p>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-zinc-400">{t('ec_kpi_dormant_sub')}</p>
            </div>
          </div>

          <div className="glass-card p-5">
            <p className="text-sm font-bold text-gray-900 dark:text-white">{t('ec_read')}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-zinc-300">
              {t('ec_read_a')} <b>{res.total.toLocaleString('fr-FR')}</b> {t('ec_read_b')}{' '}
              <b className="text-indigo-600 dark:text-indigo-400">{res.actifs.toLocaleString('fr-FR')}</b> {t('ec_read_c')}{' '}
              <b className="text-rose-600 dark:text-rose-400">{res.chantier.length.toLocaleString('fr-FR')}</b> {t('ec_read_d')}
            </p>

            {/* La ventilation qui rend le chiffre « actives » interprétable. */}
            <div className="mt-3 grid gap-3 border-t border-gray-100 pt-3 sm:grid-cols-2 dark:border-white/10">
              <div>
                <p className="text-xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {res.vendues.toLocaleString('fr-FR')}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400">{t('ec_split_sold')}</p>
              </div>
              <div>
                <p className="text-xl font-extrabold tabular-nums text-gray-500 dark:text-zinc-400">
                  {res.stockSeul.toLocaleString('fr-FR')}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400">{t('ec_split_stock')}</p>
              </div>
            </div>
            {res.stockSeul > res.vendues * 5 && res.vendues > 0 && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                {t('ec_warn_import')}
              </p>
            )}
          </div>

          <div className="glass-card overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                  <th className="px-4 py-3">{t('ec_col_criterion')}</th>
                  <th className="px-4 py-3 text-center">{t('ec_col_gravity')}</th>
                  <th className="px-4 py-3 text-right">{t('ec_col_active_missing')}</th>
                  <th className="px-4 py-3 text-right">{t('ec_col_total_missing')}</th>
                  <th className="px-4 py-3 text-right">{t('ec_col_value')}</th>
                  <th className="px-4 py-3">{t('ec_col_fix')}</th>
                </tr>
              </thead>
              <tbody>
                {res.mesures.map((m) => {
                  const fix = FIX[m.id]
                  const part = res.actifs ? Math.round((m.manquantActif / res.actifs) * 100) : 0
                  return (
                    <tr key={m.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                      <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{t(LABEL[m.id])}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${GRAVITE_STYLE[m.gravite]}`}>
                          {gravLabel(m.gravite)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-bold tabular-nums ${m.manquantActif ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {m.manquantActif.toLocaleString('fr-FR')}
                        </span>
                        <span className="ml-1 text-[11px] tabular-nums text-gray-400">{part} %</span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{m.manquantTotal.toLocaleString('fr-FR')}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{m.valeurConcernee ? fmtDH(m.valeurConcernee) : '—'}</td>
                      <td className="px-4 py-2.5">
                        {fix && m.manquantActif > 0 ? (
                          <Link href={fix.href} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:underline dark:text-amber-400">
                            {t(fix.key)}<ArrowRight className="h-3 w-3 rtl:rotate-180" />
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-zinc-700">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Contrôle de vraisemblance : un total de valorisation absurde doit
              être attribué avant d'être corrigé. */}
          <div className="glass-card p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Scale className="h-4 w-4 text-amber-500" />{t('ec_val_title')}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { l: t('ec_val_total'), v: fmtDH(res.valeur.total) },
                { l: t('ec_val_mean'), v: fmtDH(res.valeur.moyenne) },
                { l: t('ec_val_median'), v: fmtDH(res.valeur.medianeValeur), tone: 'text-emerald-600 dark:text-emerald-400' },
                // « 100 % » sur un catalogue de deux articles n'apprend rien :
                // la part des quinze premiers n'a de sens qu'au-delà de quinze.
                ...(res.valeur.top.length >= 15
                  ? [{ l: t('ec_val_top_share'), v: `${res.valeur.partTop.toFixed(1)} %` }]
                  : [{ l: t('ec_val_count'), v: res.valeur.top.length.toLocaleString('fr-FR') }]),
              ].map((c, i) => (
                <div key={i}>
                  <p className={`text-lg font-extrabold tabular-nums ${c.tone ?? 'text-gray-900 dark:text-white'}`}>{c.v}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{c.l}</p>
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-gray-500 dark:text-zinc-400">
              {t('ec_val_median_stock')} <b className="tabular-nums text-gray-900 dark:text-white">{res.valeur.medianeStock.toLocaleString('fr-FR')}</b>
              {' · '}{t('ec_val_median_cost')} <b className="tabular-nums text-gray-900 dark:text-white">{fmtDH(res.valeur.medianeCout)}</b>
            </p>

            {/* Ce bloc ne décide pas si le total est bon — seul le commerçant le
                sait. Il donne la clé de lecture, et se tait quand l'échantillon
                est trop petit pour qu'une médiane veuille dire quelque chose. */}
            <p className="mt-3 rounded-xl bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-600 dark:bg-white/5 dark:text-zinc-300">
              <b>{t('ec_val_key')}</b>{' '}
              {res.valeur.top.length < 10
                ? t('ec_val_too_few')
                : res.valeur.moyenne > res.valeur.medianeValeur * 20
                  ? t('ec_val_outliers')
                  : t('ec_val_systemic')}
            </p>

            {res.valeur.top.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                      <th className="px-2 py-2">{t('sa_col_product')}</th>
                      <th className="px-2 py-2 text-right">{t('sk_val_qty')}</th>
                      <th className="px-2 py-2 text-right">{t('ec_val_cost')}</th>
                      <th className="px-2 py-2 text-right">{t('ec_col_value')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.valeur.top.map((x) => (
                      <tr key={x.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                        <td className="px-2 py-1.5 text-gray-900 dark:text-white">{x.name}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-600 dark:text-zinc-300">{x.stock.toLocaleString('fr-FR')}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-600 dark:text-zinc-300">{fmtDH(x.cout)}</td>
                        <td className="px-2 py-1.5 text-right font-bold tabular-nums text-amber-600 dark:text-amber-400">{fmtDH(x.valeur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('ec_worklist')}</h2>
            <span className="text-xs text-gray-400">{t('ec_worklist_sub')}</span>
          </div>

          <div className="glass-card overflow-x-auto">
            {res.chantier.length === 0 ? (
              <p className="p-12 text-center text-sm text-emerald-600 dark:text-emerald-400">{t('ec_worklist_empty')}</p>
            ) : (
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                    <th className="px-4 py-3">{t('sa_col_product')}</th>
                    <th className="px-4 py-3 text-center">{t('ec_col_sold')}</th>
                    <th className="px-4 py-3 text-right">{t('ec_col_value')}</th>
                    <th className="px-4 py-3">{t('ec_col_missing')}</th>
                  </tr>
                </thead>
                <tbody>
                  {res.chantier.slice(0, shown).map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                      <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{c.name}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{c.ventes || '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{c.valeur ? fmtDH(c.valeur) : '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className="flex flex-wrap gap-1">
                          {c.manques.map((m) => (
                            <span key={m} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 dark:bg-white/10 dark:text-zinc-300">
                              {t(LABEL[m])}
                            </span>
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {res.chantier.length > shown && (
            <div className="flex justify-center">
              <button onClick={() => setShown((n) => n + PAGE * 4)} className="btn-secondary">
                {shown.toLocaleString('fr-FR')} / {res.chantier.length.toLocaleString('fr-FR')} — {t('rpst_more')}
              </button>
            </div>
          )}

          <p className="rounded-xl border border-dashed border-gray-200 p-3 text-[11px] leading-relaxed text-gray-500 dark:border-white/15 dark:text-zinc-400">
            {t('ec_note')}
          </p>
        </>
      )}
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
