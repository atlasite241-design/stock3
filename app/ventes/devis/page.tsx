'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, FileText, Plus, Printer, ShoppingCart, Trash2, X } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie, type Quote, type Sale, type SaleItem } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const STATUS_KEY: Record<Quote['status'], TKey> = {
  en_attente: 'quote_status_pending',
  accepte: 'quote_status_accepted',
  refuse: 'quote_status_refused',
  converti: 'quote_status_converted',
}
const STATUS_CHIP: Record<Quote['status'], string> = {
  en_attente: 'border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
  accepte: 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700',
  refuse: 'border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 text-rose-700',
  converti: 'border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/10 text-sky-700',
}

function Content() {
  const { ready, products, quotes, settings, addQuote, setQuoteStatus, deleteQuote, recordSale } =
    useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [newOpen, setNewOpen] = useState(false)
  const [clientName, setClientName] = useState('')
  const [lines, setLines] = useState<SaleItem[]>([])
  const [lineProduct, setLineProduct] = useState('')
  const [lineQty, setLineQty] = useState('1')
  const [printTarget, setPrintTarget] = useState<Quote | null>(null)
  const [convertTarget, setConvertTarget] = useState<Quote | null>(null)
  const [convertPayment, setConvertPayment] = useState<Sale['payment']>('especes')

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const addLine = () => {
    const p = products.find((x) => x.id === lineProduct)
    if (!p) {
      toast(t('quote_toast_choose_product'), 'error')
      return
    }
    const qty = Math.max(1, Math.round(parseFloat(lineQty.replace(',', '.')) || 0))
    setLines((ls) => {
      const ex = ls.find((l) => l.productId === p.id)
      return ex
        ? ls.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + qty } : l))
        : [...ls, { productId: p.id, name: p.name, price: p.price, qty }]
    })
    setLineProduct('')
    setLineQty('1')
  }

  const linesTotal = lines.reduce((a, l) => a + l.price * l.qty, 0)

  const createQuote = () => {
    if (!clientName.trim()) {
      toast(t('quote_toast_client_required'), 'error')
      return
    }
    if (lines.length === 0) {
      toast(t('quote_toast_add_product'), 'error')
      return
    }
    const q = addQuote(clientName.trim(), lines)
    toast(`✓ ${t('quote_prefix')} ${q.ref} ${t('quote_toast_created')}`)
    setNewOpen(false)
    setClientName('')
    setLines([])
  }

  const doConvert = () => {
    if (!convertTarget) return
    for (const i of convertTarget.items) {
      const p = products.find((x) => x.id === i.productId)
      if (!p || p.stock < i.qty) {
        toast(`${t('quote_toast_insufficient_stock')} ${i.name}`, 'error')
        return
      }
    }
    recordSale(convertTarget.items, convertPayment, null)
    setQuoteStatus(convertTarget.id, 'converti')
    toast(`✓ ${t('quote_prefix')} ${convertTarget.ref} ${t('quote_toast_converted')}`)
    setConvertTarget(null)
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('quote_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('quote_subtitle')}</p>
        </div>
        <button onClick={() => setNewOpen(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          {t('quote_new')}
        </button>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('quote_col_ref')}</th>
                <th className="px-5 py-3.5">{t('quote_col_client')}</th>
                <th className="px-5 py-3.5">{t('quote_col_items')}</th>
                <th className="px-5 py-3.5">{t('quote_col_total')}</th>
                <th className="px-5 py-3.5">{t('quote_col_status')}</th>
                <th className="px-5 py-3.5 text-right">{t('quote_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="group border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{q.ref}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">
                      {new Date(q.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-zinc-300">{q.clientName}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">
                    {q.items.reduce((a, i) => a + i.qty, 0)}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(q.total)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${STATUS_CHIP[q.status]}`}>
                      {t(STATUS_KEY[q.status])}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {q.status === 'en_attente' && (
                        <>
                          <button
                            onClick={() => setConvertTarget(q)}
                            className="btn-primary !h-8 !px-2.5 text-xs"
                            title={t('quote_accept_convert')}
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            {t('quote_convert')}
                          </button>
                          <button
                            onClick={() => {
                              setQuoteStatus(q.id, 'refuse')
                              toast(`${t('quote_prefix')} ${q.ref} ${t('quote_toast_refused')}`)
                            }}
                            className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                            title={t('quote_refuse')}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setPrintTarget(q)}
                        className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400"
                        title={t('quote_print')}
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          deleteQuote(q.id)
                          toast(`${t('quote_prefix')} ${q.ref} ${t('quote_toast_deleted')}`)
                        }}
                        className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                        title={t('quote_delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {quotes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('quote_none')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* New quote modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title={t('quote_new')} maxWidth="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="field-label">{t('quote_client_required')}</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder={t('quote_client_placeholder')}
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('quote_add_products')}</label>
            <div className="flex gap-2">
              <Select
                value={lineProduct}
                onChange={setLineProduct}
                placeholder={t('quote_product_placeholder')}
                className="flex-1"
                options={[
                  { value: '', label: t('quote_product_placeholder') },
                  ...products.map((p) => ({ value: p.id, label: `${p.name} (${fmtDH(p.price)})` })),
                ]}
              />
              <input
                type="number"
                min="1"
                value={lineQty}
                onChange={(e) => setLineQty(e.target.value)}
                className="input-field w-24"
              />
              <button onClick={addLine} className="btn-secondary shrink-0 !px-3">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          {lines.length > 0 && (
            <div className="space-y-1.5">
              {lines.map((l) => (
                <div key={l.productId} className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2">
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-zinc-100">{l.name}</span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400 tabular-nums">
                    {l.qty} × {fmtDH(l.price)}
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(l.qty * l.price)}</span>
                  <button
                    onClick={() => setLines(lines.filter((x) => x.productId !== l.productId))}
                    className="rounded p-1 text-gray-400 dark:text-zinc-500 hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex justify-between rounded-xl bg-gradient-to-r from-amber-50 dark:from-amber-500/10 to-yellow-50 dark:to-yellow-500/5 px-3 py-2.5">
                <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400">{t('quote_total')}</span>
                <span className="text-base font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(linesTotal)}</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={() => setNewOpen(false)} className="btn-secondary">
              {t('quote_cancel')}
            </button>
            <button onClick={createQuote} className="btn-primary">
              <FileText className="h-4 w-4" />
              {t('quote_create')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Convert modal */}
      <Modal open={!!convertTarget} onClose={() => setConvertTarget(null)} title={t('quote_convert_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <span className="font-semibold text-gray-900 dark:text-white">{convertTarget?.ref}</span> —{' '}
          <span className="font-bold tabular-nums">{fmtDH(convertTarget?.total ?? 0)}</span>. {t('quote_convert_desc')}
        </p>
        <div className="mt-4">
          <label className="field-label">{t('quote_payment_method')}</label>
          <Select
            value={convertPayment}
            onChange={(v) => setConvertPayment(v as Sale['payment'])}
            options={[
              { value: 'especes', label: t('pay_method_especes') },
              { value: 'carte', label: t('pos_pay_carte') },
            ]}
          />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setConvertTarget(null)} className="btn-secondary">
            {t('quote_cancel')}
          </button>
          <button onClick={doConvert} className="btn-primary">
            <Check className="h-4 w-4" />
            {t('quote_convert')}
          </button>
        </div>
      </Modal>

      {/* Print modal */}
      <Modal open={!!printTarget} onClose={() => setPrintTarget(null)} title={`${t('quote_prefix')} ${printTarget?.ref ?? ''}`} maxWidth="max-w-md">
        {printTarget && (
          <>
            <div className="print-area rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{settings.storeName}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{settings.address}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{settings.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-amber-600 dark:text-amber-400">{t('quote_title').toUpperCase()}</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">{printTarget.ref}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {new Date(printTarget.date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-700 dark:text-zinc-300">
                {t('quote_client_prefix')} <span className="font-semibold">{printTarget.clientName}</span>
              </p>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 text-left text-[11px] font-bold uppercase text-gray-400 dark:text-zinc-500">
                    <th className="py-2">{t('quote_designation')}</th>
                    <th className="py-2 text-center">{t('quote_qty_abbr')}</th>
                    <th className="py-2 text-right">{t('quote_unit_price_abbr')}</th>
                    <th className="py-2 text-right">{t('quote_col_total_short')}</th>
                  </tr>
                </thead>
                <tbody>
                  {printTarget.items.map((i) => (
                    <tr key={i.productId} className="border-b border-gray-100 dark:border-white/10">
                      <td className="py-2 text-gray-800 dark:text-zinc-100">{i.name}</td>
                      <td className="py-2 text-center tabular-nums">{i.qty}</td>
                      <td className="py-2 text-right tabular-nums">{fmtDH(i.price)}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{fmtDH(i.price * i.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex justify-end">
                <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 px-4 py-2 text-right">
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{t('quote_col_total_short')}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(printTarget.total)}</p>
                </div>
              </div>
              <p className="mt-4 text-center text-[11px] text-gray-400 dark:text-zinc-500">
                {t('quote_valid_30days')} {settings.storeName}
              </p>
            </div>
            <button onClick={() => window.print()} className="btn-primary mt-4 w-full">
              <Printer className="h-4 w-4" />
              {t('quote_print_action')}
            </button>
          </>
        )}
      </Modal>
    </>
  )
}

export default function DevisPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
