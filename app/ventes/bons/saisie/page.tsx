'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, Check, RotateCcw, ScanLine, Trash2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import BonStatusPill from '@/components/BonStatusPill'
import { fmtBonDate, fmtBonTime } from '@/components/BonsTable'
import { useToast } from '@/components/Toast'
import { usePermissions } from '@/lib/access'
import { fmtDH, roundMoney, useDroguerie, type BonPapier, type SaleItem } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type Pay = 'especes' | 'carte' | 'credit' | 'mixte'
interface Line { productId: string; name: string; price: number; qty: number }

const PAY_KEYS: { mode: Pay; key: 'bon_pay_especes' | 'bon_pay_carte' | 'bon_pay_credit' | 'bon_pay_mixte' }[] = [
  { mode: 'especes', key: 'bon_pay_especes' },
  { mode: 'carte', key: 'bon_pay_carte' },
  { mode: 'credit', key: 'bon_pay_credit' },
  { mode: 'mixte', key: 'bon_pay_mixte' },
]

function Content() {
  const { ready, bons, reopenBon } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id') ?? ''

  const bon = useMemo(() => bons.find((b) => b.id === id), [bons, id])

  const corriger = () => {
    if (!bon) return
    const r = reopenBon(bon.id)
    if (!r.ok) { toast(r.raison === 'retours' ? t('bon_reopen_returns') : t('bon_saisie_not_found'), 'error'); return }
    toast(t('bon_reopen_done'))
    // Le bon repasse « en cours » : l'écran de saisie s'affiche automatiquement.
  }

  if (!ready) return <Loader />

  if (!bon) {
    return (
      <div className="glass-card p-10 text-center">
        <p className="text-sm text-gray-500 dark:text-zinc-400">{t('bon_saisie_not_found')}</p>
        <button onClick={() => router.push('/ventes/bons/a-saisir')} className="btn-secondary mt-4">
          <ArrowLeft className="h-4 w-4" />{t('bon_to_enter_title')}
        </button>
      </div>
    )
  }

  const header = (
    <div className="glass-card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
      <div><span className="text-[10px] font-bold uppercase text-gray-400">{t('bon_col_ref')}</span><div className="font-mono font-bold text-gray-900 dark:text-white">{bon.ref}</div></div>
      <div><span className="text-[10px] font-bold uppercase text-gray-400">{t('bon_col_client')}</span><div className="font-semibold text-gray-900 dark:text-white">{bon.clientName}</div></div>
      <div><span className="text-[10px] font-bold uppercase text-gray-400">{t('bon_col_client_code')}</span><div className="font-mono text-gray-600 dark:text-zinc-300">{bon.clientCode ?? '—'}</div></div>
      <div><span className="text-[10px] font-bold uppercase text-gray-400">{t('bon_col_date')}</span><div className="tabular-nums text-gray-600 dark:text-zinc-300">{fmtBonDate(bon.date)} · {fmtBonTime(bon.date)}</div></div>
      <div className="ml-auto"><BonStatusPill status={bon.status} /></div>
    </div>
  )

  // ---- Garde-fou anti-double-saisie ----
  if (bon.status === 'saisi') {
    return (
      <>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 sm:text-3xl">
            <AlertTriangle className="h-6 w-6" />{t('bon_already_title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('bon_already_sub')}</p>
        </motion.div>
        {header}
        <div className="glass-card grid gap-3 p-5 sm:grid-cols-2">
          <Info label={t('bon_already_saved_on')} value={bon.saisiAt ? `${fmtBonDate(bon.saisiAt)} · ${fmtBonTime(bon.saisiAt)}` : '—'} />
          <Info label={t('bon_already_by')} value={bon.saisiPar ?? '—'} />
          <Info label={t('bon_col_amount')} value={fmtDH(bon.total)} />
          <Info label={t('bon_already_invoice')} value={bon.invoiceNo ?? '—'} mono />
        </div>
        <div className="flex flex-wrap gap-2">
          {can('bons.reopen') && (
            <button onClick={corriger} className="btn-secondary">
              <RotateCcw className="h-4 w-4" />{t('bon_already_correct')}
            </button>
          )}
          <button onClick={() => router.push('/ventes/bons/saisis')} className="btn-secondary">
            <ArrowLeft className="h-4 w-4" />{t('bon_entered_title')}
          </button>
        </div>
      </>
    )
  }

  // Écran de saisie isolé et remonté par bon (key) : son état local se sème une
  // fois, proprement, à partir des lignes du bon — sans effet en cascade.
  return <Entry key={bon.id} bon={bon} header={header} />
}

function Entry({ bon, header }: { bon: BonPapier; header: React.ReactNode }) {
  const { products, validateBon, saveBonItems, startSaisieBon } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()
  const router = useRouter()

  const [lines, setLines] = useState<Line[]>(() =>
    bon.items.map((i) => ({ productId: i.productId, name: i.name, price: i.price, qty: i.qty }))
  )
  const [query, setQuery] = useState('')
  const [payment, setPayment] = useState<Pay>('especes')
  const [cashPart, setCashPart] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Ouverture de la saisie côté store (système externe) au montage.
  useEffect(() => {
    if (bon.status === 'cree' || bon.status === 'attente') startSaisieBon(bon.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const byBarcode = useMemo(() => {
    const m = new Map<string, (typeof products)[number]>()
    for (const p of products) {
      if (p.barcode) m.set(p.barcode, p)
      for (const alt of p.altBarcodes ?? []) m.set(alt, p)
    }
    return m
  }, [products])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q)).slice(0, 8)
  }, [products, query])

  const total = useMemo(() => roundMoney(lines.reduce((s, l) => s + l.price * l.qty, 0)), [lines])

  const addProduct = (p: { id: string; name: string; price: number }) => {
    setLines((prev) => {
      const at = prev.findIndex((l) => l.productId === p.id)
      if (at >= 0) { const next = [...prev]; next[at] = { ...next[at], qty: next[at].qty + 1 }; return next }
      return [...prev, { productId: p.id, name: p.name, price: p.price, qty: 1 }]
    })
    setQuery('')
    searchRef.current?.focus()
  }

  const onSearchEnter = () => {
    const raw = query.trim()
    if (!raw) return
    const exact = byBarcode.get(raw)
    if (exact) { addProduct(exact); return }
    if (suggestions.length) addProduct(suggestions[0])
  }

  const setQty = (pid: string, v: string) => {
    const q = Math.max(0, Number(v.replace(',', '.')) || 0)
    setLines((prev) => prev.map((l) => (l.productId === pid ? { ...l, qty: q } : l)))
  }
  const setPrice = (pid: string, v: string) => {
    const p = Math.max(0, Number(v.replace(',', '.')) || 0)
    setLines((prev) => prev.map((l) => (l.productId === pid ? { ...l, price: p } : l)))
  }
  const remove = (pid: string) => setLines((prev) => prev.filter((l) => l.productId !== pid))

  const items = (): SaleItem[] => lines.filter((l) => l.qty > 0).map((l) => ({ productId: l.productId, name: l.name, price: l.price, qty: l.qty }))

  const saveDraft = () => { saveBonItems(bon.id, items()); toast(t('bon_saisie_save_draft')) }

  const validate = () => {
    if (submitting) return
    const it = items()
    if (!it.length) { toast(t('bon_saisie_empty'), 'error'); return }
    setSubmitting(true)
    const cash = payment === 'mixte' ? Math.max(0, Math.min(Number(cashPart.replace(',', '.')) || 0, total)) : undefined
    const r = validateBon(bon.id, it, payment, cash)
    if (!r.ok) {
      setSubmitting(false)
      toast(r.raison === 'deja' ? t('bon_already_title') : t('bon_saisie_empty'), 'error')
      return
    }
    toast(`${t('bon_saisie_done')} — ${r.sale.invoiceNo ?? ''}`)
    router.push('/ventes/bons/saisis')
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <ScanLine className="h-6 w-6 text-amber-500" />{t('bon_saisie_title')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('bon_saisie_sub')}</p>
      </motion.div>

      {header}

      {/* Ajout de produit : scan douchette (Enter) ou recherche + clic. */}
      <div className="glass-card relative p-3">
        <div className="relative">
          <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-500" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearchEnter() }}
            placeholder={t('bon_saisie_scan_product')}
            autoComplete="off"
            className="input-field h-12 pl-11 font-mono"
          />
        </div>
        {suggestions.length > 0 && (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-gray-100 dark:border-white/10">
            {suggestions.map((p) => (
              <button key={p.id} onClick={() => addProduct(p)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50 dark:hover:bg-amber-500/10">
                <span className="truncate font-semibold text-gray-900 dark:text-white">{p.name}</span>
                <span className="shrink-0 tabular-nums text-gray-500">{fmtDH(p.price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="glass-card p-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('bon_saisie_empty')}</div>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                <th className="px-4 py-3">{t('bon_col_client')}</th>
                <th className="px-4 py-3 text-center">{t('bon_saisie_qty')}</th>
                <th className="px-4 py-3 text-center">{t('bon_saisie_price')}</th>
                <th className="px-4 py-3 text-right">{t('bon_saisie_total')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.productId} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2 font-semibold text-gray-900 dark:text-white">{l.name}</td>
                  <td className="px-4 py-2 text-center">
                    <input type="number" min="0" step="any" value={l.qty} onChange={(e) => setQty(l.productId, e.target.value)} className="input-field h-9 w-20 text-center tabular-nums" />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input type="number" min="0" step="any" value={l.price} onChange={(e) => setPrice(l.productId, e.target.value)} className="input-field h-9 w-24 text-center tabular-nums" />
                  </td>
                  <td className="px-4 py-2 text-right font-bold tabular-nums text-gray-900 dark:text-white">{fmtDH(roundMoney(l.price * l.qty))}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => remove(l.productId)} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paiement + validation */}
      <div className="glass-card space-y-4 p-4">
        <div>
          <label className="field-label">{t('bon_saisie_payment')}</label>
          <div className="flex flex-wrap gap-2">
            {PAY_KEYS.map(({ mode, key }) => (
              <button
                key={mode}
                onClick={() => setPayment(mode)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  payment === mode
                    ? 'border-amber-500 bg-amber-500 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-amber-300 dark:border-white/10 dark:text-zinc-300'
                }`}
              >
                {t(key)}
              </button>
            ))}
          </div>
        </div>

        {payment === 'mixte' && (
          <div className="max-w-xs">
            <label className="field-label">{t('bon_mixte_cash')}</label>
            <input type="number" min="0" step="any" value={cashPart} onChange={(e) => setCashPart(e.target.value)} placeholder="0" className="input-field tabular-nums" />
          </div>
        )}

        <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-white/10">
          <span className="text-sm font-semibold text-gray-500 dark:text-zinc-400">{t('bon_saisie_total')}</span>
          <span className="text-2xl font-extrabold tabular-nums text-gray-900 dark:text-white">{fmtDH(total)}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={saveDraft} className="btn-secondary flex-1">{t('bon_saisie_save_draft')}</button>
          <button
            onClick={validate}
            disabled={submitting || !can('bons.validate') || lines.every((l) => l.qty <= 0)}
            className="btn-primary flex-[2] disabled:opacity-40"
          >
            <Check className="h-4 w-4" />{t('bon_saisie_validate')}
          </button>
        </div>
      </div>
    </>
  )
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
      <div className={`font-semibold text-gray-900 dark:text-white ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

export default function Page() {
  return (
    <AppShell>
      <Suspense fallback={<Loader />}>
        <Content />
      </Suspense>
    </AppShell>
  )
}
