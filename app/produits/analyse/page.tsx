'use client'

// Analyse du catalogue : d'où viennent les fiches en trop.
//
// Le catalogue distant comptait six fois plus de fiches que le catalogue réel.
// Cet écran mesure l'écart et le décompose, SANS rien modifier : le nettoyage
// est une action distincte, chiffrée et confirmée.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Barcode, Download, Layers, Merge, Store, TriangleAlert } from 'lucide-react'
import AppShell from '@/components/AppShell'
import DangerConfirm from '@/components/DangerConfirm'
import Loader from '@/components/Loader'
import { useToast } from '@/components/Toast'
import { availableStock, createBackup, useDroguerie, type Product } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

/** Normalise un nom pour comparer : sans accents, casse ni ponctuation. */
const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Fiche à CONSERVER dans un groupe de doublons : celle qui porte du stock,
 * sinon celle qui a un emplacement, sinon la plus renseignée. On ne supprime
 * jamais une fiche qui détient l'information la plus riche.
 */
const score = (p: Product) =>
  availableStock(p) * 1000 + (p.emplacementComplet ? 500 : 0) + (p.price > 0 ? 50 : 0) + (p.cost > 0 ? 25 : 0) + (p.category ? 10 : 0)

const bestOf = (list: Product[]) => list.reduce((a, b) => (score(b) > score(a) ? b : a))

function Content() {
  const { ready, products, stores, mergeDuplicateProducts } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)
  const [confirmName, setConfirmName] = useState(false)
  const [merged, setMerged] = useState<{ groupes: number; supprimees: number; stockAvant: number; stockApres: number } | null>(null)

  const a = useMemo(() => {
    const byBarcode = new Map<string, Product[]>()
    const byName = new Map<string, Product[]>()
    const noBarcode: Product[] = []
    const noStore: Product[] = []
    const perStore = new Map<string, number>()

    for (const p of products) {
      const bc = (p.barcode || '').trim()
      if (bc) {
        const l = byBarcode.get(bc) ?? []
        l.push(p)
        byBarcode.set(bc, l)
      } else {
        noBarcode.push(p)
      }
      const n = norm(p.name)
      if (n) {
        const l = byName.get(n) ?? []
        l.push(p)
        byName.set(n, l)
      }
      const sid = p.storeId ?? ''
      perStore.set(sid, (perStore.get(sid) ?? 0) + 1)
      if (!p.storeId) noStore.push(p)
    }

    const dupBarcode = [...byBarcode.entries()].filter(([, l]) => l.length > 1).sort((x, y) => y[1].length - x[1].length)
    // Un même nom sur plusieurs codes-barres n'est PAS forcément un doublon
    // (conditionnements différents) : on le signale sans jamais le supprimer.
    const dupName = [...byName.entries()]
      .filter(([, l]) => l.length > 1 && new Set(l.map((p) => p.barcode)).size > 1)
      .sort((x, y) => y[1].length - x[1].length)

    const removable: string[] = []
    for (const [, list] of dupBarcode) {
      const keep = bestOf(list)
      for (const p of list) if (p.id !== keep.id) removable.push(p.id)
    }

    return {
      dupBarcode, dupName, noBarcode, noStore, perStore, removable,
      uniqueBarcodes: byBarcode.size,
    }
  }, [products])

  if (!ready) return <Loader />

  const storeName = (id: string) => (id ? stores.find((s) => s.id === id)?.name ?? id : t('pa_no_store_label'))

  const exportCsv = () => {
    const rows: (string | number)[][] = [['Type', 'Clé', 'Code-barres', 'Produit', 'Stock', 'Magasin']]
    for (const [bc, list] of a.dupBarcode) for (const p of list) rows.push(['barcode', bc, p.barcode, p.name, availableStock(p), p.storeId ?? ''])
    for (const [n, list] of a.dupName) for (const p of list) rows.push(['nom', n, p.barcode, p.name, availableStock(p), p.storeId ?? ''])
    const csv = rows.map((r) => r.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const el = document.createElement('a'); el.href = url; el.download = 'analyse-catalogue.csv'; el.click(); URL.revokeObjectURL(url)
  }

  const clean = () => {
    // Sauvegarde AVANT : l'opération touche des dizaines de milliers de fiches
    // et n'est pas annulable depuis l'écran.
    try { createBackup(`Avant fusion des doublons — ${new Date().toLocaleString('fr-FR')}`) } catch {}
    const r = mergeDuplicateProducts(a.dupBarcode.map(([, list]) => list.map((p) => p.id)))
    setConfirm(false)
    setMerged(r)
    toast(r.groupes > 0 ? `✓ ${r.supprimees.toLocaleString('fr-FR')} ${t('pa_absorbed')}` : t('pa_nothing'))
  }

  /** Fiches absorbées si l'on fusionne les groupes de même nom. */
  const removableByName = a.dupName.reduce((n, [, l]) => n + l.length - 1, 0)

  const mergeByName = () => {
    try { createBackup(`Avant fusion des doublons par nom — ${new Date().toLocaleString('fr-FR')}`) } catch {}
    const r = mergeDuplicateProducts(a.dupName.map(([, list]) => list.map((p) => p.id)))
    setConfirmName(false)
    setMerged(r)
    toast(r.groupes > 0 ? `✓ ${r.supprimees.toLocaleString('fr-FR')} ${t('pa_absorbed')}` : t('pa_nothing'))
  }

  const kpis = [
    { v: products.length, l: t('pa_total'), c: 'text-gray-900 dark:text-white' },
    { v: a.uniqueBarcodes, l: t('pa_unique_bc'), c: 'text-indigo-600 dark:text-indigo-400' },
    { v: a.removable.length, l: t('pa_dup_extra'), c: a.removable.length ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400' },
    { v: a.perStore.size, l: t('pa_stores'), c: 'text-violet-600 dark:text-violet-400' },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Layers className="h-6 w-6 text-amber-500" />{t('pa_title')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">{t('pa_sub')}</p>
        </div>
        <button onClick={exportCsv} className="btn-secondary"><Download className="h-4 w-4" />CSV</button>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((s, i) => (
          <div key={i} className="glass-card p-4 text-center">
            <p className={`text-2xl font-extrabold tabular-nums ${s.c}`}>{s.v.toLocaleString('fr-FR')}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Doublons certains : même code-barres */}
      <section className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4 dark:border-white/10">
          <Barcode className="h-5 w-5 shrink-0 text-rose-500" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-gray-800 dark:text-zinc-100">{t('pa_sec_bc')}</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">{t('pa_sec_bc_d')}</p>
          </div>
          <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold tabular-nums text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
            {a.dupBarcode.length.toLocaleString('fr-FR')} {t('pa_groups')}
          </span>
        </div>
        {a.dupBarcode.length === 0 ? (
          <p className="p-6 text-center text-sm text-emerald-600 dark:text-emerald-400">{t('pa_clean_ok')}</p>
        ) : (
          <>
            <div className="max-h-80 overflow-y-auto">
              {a.dupBarcode.slice(0, 100).map(([bc, list]) => {
                const keep = bestOf(list)
                return (
                  <div key={bc} className="border-b border-gray-50 px-4 py-2 text-xs last:border-0 dark:border-white/5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-gray-700 dark:text-zinc-200">{bc}</span>
                      <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                        {list.length} {t('pa_copies')}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-gray-500 dark:text-zinc-400">{keep.name}</span>
                      <span className="tabular-nums text-gray-400">{availableStock(keep)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {a.dupBarcode.length > 100 && (
              <p className="p-2 text-center text-[11px] text-gray-400">
                + {(a.dupBarcode.length - 100).toLocaleString('fr-FR')} {t('pa_more')}
              </p>
            )}
            <div className="space-y-2 border-t border-gray-100 p-4 dark:border-white/10">
              <p className="text-xs text-gray-500 dark:text-zinc-400">{t('pa_merge_rule')}</p>
              <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('pa_warn')}
              </p>
              <button onClick={() => setConfirm(true)} disabled={a.removable.length === 0} className="btn-primary w-full disabled:opacity-40">
                <Merge className="h-4 w-4" />{t('pa_merge')} · {a.removable.length.toLocaleString('fr-FR')}
              </button>
              {merged && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <p className="font-bold">
                    {merged.groupes.toLocaleString('fr-FR')} {t('pa_groups')} · {merged.supprimees.toLocaleString('fr-FR')} {t('pa_absorbed')}
                  </p>
                  {/* Le contrôle qui prouve que rien n'a été perdu. */}
                  <p className="mt-1 tabular-nums">
                    {t('pa_stock_before')} {merged.stockAvant.toLocaleString('fr-FR')} → {t('pa_stock_after')} {merged.stockApres.toLocaleString('fr-FR')}
                    {merged.stockAvant === merged.stockApres
                      ? <span className="ml-1 font-bold">✓ {t('pa_stock_ok')}</span>
                      : <span className="ml-1 font-bold text-rose-600 dark:text-rose-400">✗ {t('pa_stock_ko')}</span>}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Signalements sans action automatique */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { icon: Layers, title: t('pa_sec_name'), desc: t('pa_sec_name_d'), n: a.dupName.length, unit: t('pa_groups'),
            rows: a.dupName.slice(0, 40).map(([n, l]) => ({ k: n, v: `${l.length} ${t('pa_copies')}` })) },
          { icon: Barcode, title: t('pa_sec_nobc'), desc: t('pa_sec_nobc_d'), n: a.noBarcode.length, unit: t('pa_copies'),
            rows: a.noBarcode.slice(0, 40).map((p) => ({ k: p.name, v: String(availableStock(p)) })) },
          { icon: Store, title: t('pa_sec_nostore'), desc: t('pa_sec_nostore_d'), n: a.noStore.length, unit: t('pa_copies'),
            rows: a.noStore.slice(0, 40).map((p) => ({ k: p.name, v: String(availableStock(p)) })) },
          { icon: Store, title: t('pa_sec_bystore'), desc: '', n: a.perStore.size, unit: '',
            rows: [...a.perStore.entries()].sort((x, y) => y[1] - x[1]).map(([id, n]) => ({ k: storeName(id), v: n.toLocaleString('fr-FR') })) },
        ].map((s, i) => (
          <section key={i} className="glass-card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-gray-100 p-4 dark:border-white/10">
              <s.icon className="h-5 w-5 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-gray-800 dark:text-zinc-100">{s.title}</h2>
                {s.desc && <p className="text-xs text-gray-500 dark:text-zinc-400">{s.desc}</p>}
              </div>
              <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold tabular-nums text-gray-600 dark:bg-white/10 dark:text-zinc-300">
                {s.n.toLocaleString('fr-FR')} {s.unit}
              </span>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {s.rows.map((r, j) => (
                <div key={j} className="flex items-center justify-between gap-3 border-b border-gray-50 px-4 py-1.5 text-xs last:border-0 dark:border-white/5">
                  <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-zinc-300">{r.k}</span>
                  <span className="shrink-0 tabular-nums text-gray-400">{r.v}</span>
                </div>
              ))}
              {s.rows.length === 0 && <p className="p-5 text-center text-xs text-emerald-600 dark:text-emerald-400">{t('pa_clean_ok')}</p>}
            </div>
            {i === 0 && a.dupName.length > 0 && (
              <div className="space-y-2 border-t border-gray-100 p-4 dark:border-white/10">
                <p className="text-xs leading-relaxed text-gray-500 dark:text-zinc-400">{t('pa_name_rule')}</p>
                <button onClick={() => setConfirmName(true)} className="btn-primary w-full">
                  <Merge className="h-4 w-4" />{t('pa_merge_name')} · {removableByName.toLocaleString('fr-FR')}
                </button>
              </div>
            )}
          </section>
        ))}
      </div>

      <DangerConfirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={clean}
        title={t('pa_confirm_title')}
        description={<>{a.removable.length.toLocaleString('fr-FR')} {t('pa_confirm_desc')}</>}
        actionLabel={t('pa_merge')}
      />

      <DangerConfirm
        open={confirmName}
        onClose={() => setConfirmName(false)}
        onConfirm={mergeByName}
        title={t('pa_confirm_name_title')}
        description={<>{removableByName.toLocaleString('fr-FR')} {t('pa_confirm_name_desc')}</>}
        actionLabel={t('pa_merge_name')}
      />
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
