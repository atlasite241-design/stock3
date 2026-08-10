'use client'

// Contrôle et validation d'un inventaire : comparaison théorique/réel ligne à
// ligne, analyse des écarts (motifs modifiables au contrôle), puis validation
// (ajustement automatique du stock) — réservée à stock.inventory_validate.
// Un inventaire validé est immuable ; l'écran sert alors de procès-verbal.

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, BadgeCheck, Pencil, Printer, ShieldCheck, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { usePermissions } from '@/lib/access'
import { fmtDH, INVENTORY_META, inventoryDiffs, useDroguerie } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const STATUS_KEY: Record<string, TKey> = {
  brouillon: 'inv_status_brouillon',
  controle: 'inv_status_controle',
  valide: 'inv_status_valide',
  annule: 'inv_status_annule',
}

const MOTIFS: TKey[] = [
  'sk_adj_r_break', 'sk_adj_r_loss', 'sk_adj_r_theft', 'sk_adj_r_typo',
  'sk_adj_r_return', 'sk_adj_r_gift', 'sk_adj_r_other',
]

function Content() {
  const { ready, inventories, products, depots, updateInventory, reopenInventory, validateInventory, cancelInventory } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const id = useSearchParams().get('id') ?? ''
  const inv = inventories.find((i) => i.id === id)

  const [confirmValidate, setConfirmValidate] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const cost = useMemo(() => new Map(products.map((p) => [p.id, p.cost])), [products])

  if (!ready) return <Loader />

  if (!inv) {
    return (
      <div className="glass-card flex flex-col items-center gap-3 p-12 text-center">
        <p className="text-sm text-gray-500 dark:text-zinc-400">{t('inv_not_found')}</p>
        <button onClick={() => router.push('/stock/inventaires')} className="btn-secondary">
          <ArrowLeft className="h-4 w-4" />
          {t('inv_back_dash')}
        </button>
      </div>
    )
  }

  const diffs = inventoryDiffs(inv)
  const countedLines = inv.lines.filter((l) => l.countedAt)
  const totalValue = diffs.reduce((s, l) => s + (l.counted - l.theoretical) * (cost.get(l.productId) ?? 0), 0)
  const plus = diffs.filter((l) => l.counted > l.theoretical).length
  const minus = diffs.length - plus

  const doValidate = () => {
    const r = validateInventory(inv.id)
    setConfirmValidate(false)
    if (r.ok) toast(`✓ ${inv.ref} ${t('inv_validated')} — ${r.adjusted} ${t('inv_adjusted')}`)
  }

  const doCancel = () => {
    cancelInventory(inv.id)
    setConfirmCancel(false)
    toast(`${inv.ref} ${t('inv_cancelled')}`)
  }

  const setReason = (productId: string, reason: string) => {
    updateInventory(inv.id, {
      lines: inv.lines.map((l) => (l.productId === productId ? { ...l, reason: reason || undefined } : l)),
    })
  }

  const trace: { label: TKey; who?: string; when?: string }[] = [
    { label: 'inv_trace_created', who: inv.createdBy, when: inv.date },
    { label: 'inv_trace_submitted', who: inv.submittedBy, when: inv.submittedAt },
    { label: 'inv_trace_validated', who: inv.validatedBy, when: inv.validatedAt },
    { label: 'inv_trace_cancelled', who: inv.cancelledBy, when: inv.cancelledAt },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4 no-print">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <ShieldCheck className="h-6 w-6 text-amber-500" />
            {t('inv_ctrl_title')} — <span className="text-amber-600 dark:text-amber-400">{inv.ref}</span>
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${INVENTORY_META[inv.status].chip}`}>
              {t(STATUS_KEY[inv.status])}
            </span>
            {inv.kind === 'physique' ? t('inv_phys_title') : t('inv_cy_title')}
            {inv.depotId && <> · {t('inv_depot')} : {depots.find((d) => d.id === inv.depotId)?.name ?? '—'}</>}
            {inv.note && <> · {inv.note}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer className="h-4 w-4" />
            {t('inv_print_btn')}
          </button>
          {inv.status === 'controle' && can('stock.inventory_count') && (
            <button onClick={() => { reopenInventory(inv.id); router.push(`/stock/inventaires/${inv.kind === 'physique' ? 'physique' : 'tournant'}?id=${inv.id}`) }} className="btn-secondary">
              <Pencil className="h-4 w-4" />
              {t('inv_reopen')}
            </button>
          )}
          {inv.status !== 'valide' && inv.status !== 'annule' && can('stock.inventory_cancel') && (
            <button onClick={() => setConfirmCancel(true)} className="btn-secondary !text-rose-500">
              <Trash2 className="h-4 w-4" />
              {t('inv_cancel_btn')}
            </button>
          )}
          {inv.status === 'controle' && can('stock.inventory_validate') && (
            <button onClick={() => setConfirmValidate(true)} className="btn-primary">
              <BadgeCheck className="h-4 w-4" />
              {t('inv_validate')}
            </button>
          )}
        </div>
      </motion.div>

      <div className="print-area space-y-6">
        {/* Synthèse */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { v: String(countedLines.length), l: t('inv_kpi_counted_total'), c: 'text-gray-900 dark:text-white' },
            { v: `+${plus}`, l: t('inv_kpi_plus'), c: 'text-emerald-600 dark:text-emerald-400' },
            { v: `−${minus}`, l: t('inv_kpi_minus'), c: 'text-rose-500' },
            { v: fmtDH(totalValue), l: t('inv_kpi_gap_value'), c: totalValue < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400' },
          ].map((s, i) => (
            <div key={i} className="glass-card p-4 text-center">
              <p className={`text-xl font-extrabold tabular-nums ${s.c}`}>{s.v}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Écarts */}
        <div className="glass-card overflow-x-auto">
          {diffs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <BadgeCheck className="h-10 w-10 text-emerald-400" />
              <p className="text-sm text-gray-500 dark:text-zinc-400">{t('inv_no_gaps')}</p>
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                  <th className="px-4 py-3">{t('inv_col_name')}</th>
                  <th className="px-4 py-3">{t('inv_col_category')}</th>
                  <th className="px-4 py-3 text-center">{t('inv_col_theoretical')}</th>
                  <th className="px-4 py-3 text-center">{t('inv_col_counted')}</th>
                  <th className="px-4 py-3 text-center">{t('inv_col_gap')}</th>
                  <th className="px-4 py-3 text-right">{t('inv_col_value')}</th>
                  <th className="px-4 py-3">{t('inv_col_reason')}</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((l) => {
                  const d = l.counted - l.theoretical
                  const v = d * (cost.get(l.productId) ?? 0)
                  return (
                    <tr key={l.productId} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                      <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{l.productName}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{l.category ?? '—'}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{l.theoretical}</td>
                      <td className="px-4 py-2.5 text-center font-bold tabular-nums text-gray-900 dark:text-white">{l.counted}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${d < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {d < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                          {d > 0 ? '+' : ''}{Math.round(d * 1000) / 1000}
                        </span>
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${v < 0 ? 'text-rose-500' : 'text-gray-600 dark:text-zinc-300'}`}>{fmtDH(v)}</td>
                      <td className="px-4 py-2.5">
                        {inv.status === 'controle' && can('stock.inventory_count') ? (
                          <Select
                            value={l.reason ?? ''}
                            onChange={(v2) => setReason(l.productId, v2)}
                            options={[{ value: '', label: t('inv_reason_none') }, ...MOTIFS.map((m) => ({ value: m, label: t(m) }))]}
                            className="w-40 no-print"
                          />
                        ) : (
                          <span className="text-xs text-gray-500">{l.reason ? t(l.reason as TKey) : '—'}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Traçabilité */}
        <div className="glass-card p-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">{t('inv_trace_title')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {trace.filter((e) => e.when).map((e) => (
              <div key={e.label} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-white/10">
                <span className="text-gray-500 dark:text-zinc-400">{t(e.label)}</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {e.who ?? '—'} · {new Date(e.when!).toLocaleString('fr-FR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation de validation */}
      <Modal open={confirmValidate} onClose={() => setConfirmValidate(false)} title={t('inv_validate_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-300">
          {t('inv_validate_desc_1')} <b>{diffs.length}</b> {t('inv_validate_desc_2')}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setConfirmValidate(false)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={doValidate} className="btn-primary">
            <BadgeCheck className="h-4 w-4" />
            {t('inv_validate')}
          </button>
        </div>
      </Modal>

      {/* Confirmation d'annulation */}
      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title={t('inv_cancelconfirm_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-300">{t('inv_cancel_desc')}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setConfirmCancel(false)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={doCancel} className="btn-danger">
            <Trash2 className="h-4 w-4" />
            {t('inv_cancel_btn')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
