'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PackageCheck, Plus, Printer } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { useDroguerie, type Purchase } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, purchases, recordDeliveryNote } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [newOpen, setNewOpen] = useState(false)
  const [purchaseId, setPurchaseId] = useState('')
  const [carrier, setCarrier] = useState('')
  const [note, setNote] = useState('')
  const [delivered, setDelivered] = useState<Record<string, string>>({})
  const [printTarget, setPrintTarget] = useState<Purchase | null>(null)

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const withBl = [...purchases].filter((p) => p.blRef).sort((a, b) => (b.blDate ?? '').localeCompare(a.blDate ?? ''))
  const eligible = purchases.filter((p) => p.status === 'en_attente' || p.status === 'partiellement_recue')
  const selected = purchases.find((p) => p.id === purchaseId) ?? null

  const openNew = () => {
    setPurchaseId('')
    setCarrier('')
    setNote('')
    setDelivered({})
    setNewOpen(true)
  }

  const pickOrder = (id: string) => {
    setPurchaseId(id)
    const po = purchases.find((p) => p.id === id)
    const init: Record<string, string> = {}
    po?.items.forEach((i) => (init[i.productId] = String(i.deliveredQty ?? i.qty)))
    setDelivered(init)
  }

  const save = () => {
    if (!selected) {
      toast(t('pbl_toast_choose_order'), 'error')
      return
    }
    const items = selected.items.map((i) => ({ productId: i.productId, deliveredQty: Math.max(0, Math.round(parseFloat((delivered[i.productId] ?? '0').replace(',', '.')) || 0)) }))
    recordDeliveryNote(selected.id, items, { carrier, note })
    toast(`✓ ${t('pbl_toast_saved')}`)
    setNewOpen(false)
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('pbl_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('pbl_subtitle')}</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="h-4 w-4" />
          {t('pbl_new')}
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('pbl_col_ref')}</th>
                <th className="px-5 py-3.5">{t('pbl_col_order_ref')}</th>
                <th className="px-5 py-3.5">{t('pbl_col_supplier')}</th>
                <th className="px-5 py-3.5">{t('pbl_col_date')}</th>
                <th className="px-5 py-3.5">{t('pbl_col_carrier')}</th>
                <th className="px-5 py-3.5 text-right">{t('pbl_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {withBl.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{p.blRef}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{p.ref}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-zinc-300">{p.supplierName}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">
                    {p.blDate ? new Date(p.blDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{p.blCarrier || '—'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setPrintTarget(p)} className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-sky-50 hover:text-sky-600" title={t('pbl_print')}>
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {withBl.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('pbl_none')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* New delivery note modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title={t('pbl_new')} maxWidth="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="field-label">{t('pbl_order_label')}</label>
            <Select
              value={purchaseId}
              onChange={pickOrder}
              placeholder={t('pbl_choose_order')}
              options={[{ value: '', label: t('pbl_choose_order') }, ...eligible.map((p) => ({ value: p.id, label: `${p.ref} — ${p.supplierName}` }))]}
            />
            {eligible.length === 0 && <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">{t('pbl_no_orders')}</p>}
          </div>

          {selected && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">{t('pbl_carrier_label')}</label>
                  <input type="text" value={carrier} onChange={(e) => setCarrier(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="field-label">{t('pbl_note_label')}</label>
                  <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="input-field" />
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                      <th className="px-3 py-2">{t('po_col_designation')}</th>
                      <th className="px-3 py-2 text-center">{t('pbl_col_ordered')}</th>
                      <th className="px-3 py-2 text-center">{t('pbl_col_delivered')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((i) => (
                      <tr key={i.productId} className="border-b border-gray-50 dark:border-white/5">
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{i.name}</td>
                        <td className="px-3 py-2 text-center tabular-nums text-gray-600 dark:text-zinc-400">{i.qty}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={delivered[i.productId] ?? ''}
                            onChange={(e) => setDelivered({ ...delivered, [i.productId]: e.target.value })}
                            className="input-field !h-9 w-20 text-center"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={() => setNewOpen(false)} className="btn-secondary">
              {t('pbl_cancel')}
            </button>
            <button onClick={save} className="btn-primary">
              <PackageCheck className="h-4 w-4" />
              {t('pbl_save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Print modal */}
      <Modal open={!!printTarget} onClose={() => setPrintTarget(null)} title={printTarget?.blRef ?? ''} maxWidth="max-w-md">
        {printTarget && (
          <>
            <div className="print-area rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{t('pbl_title')}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{printTarget.supplierName}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-amber-600 dark:text-amber-400">{printTarget.blRef}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {printTarget.blDate ? new Date(printTarget.blDate).toLocaleDateString('fr-FR') : ''}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
                {t('pbl_order_label')}: {printTarget.ref} — {t('pbl_carrier_label')}: {printTarget.blCarrier || '—'}
              </p>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 text-left text-[11px] font-bold uppercase text-gray-400 dark:text-zinc-500">
                    <th className="py-2">{t('po_col_designation')}</th>
                    <th className="py-2 text-right">{t('pbl_col_ordered')}</th>
                    <th className="py-2 text-right">{t('pbl_col_delivered')}</th>
                  </tr>
                </thead>
                <tbody>
                  {printTarget.items.map((i) => (
                    <tr key={i.productId} className="border-b border-gray-100 dark:border-white/10">
                      <td className="py-2 text-gray-800 dark:text-zinc-100">{i.name}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{i.qty}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{i.deliveredQty ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {printTarget.blNote && <p className="mt-3 text-xs text-gray-500 dark:text-zinc-400">{printTarget.blNote}</p>}
            </div>
            <button onClick={() => window.print()} className="btn-primary mt-4 w-full">
              <Printer className="h-4 w-4" />
              {t('pbl_print')}
            </button>
          </>
        )}
      </Modal>
    </>
  )
}

export default function BonLivraisonAchatsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
