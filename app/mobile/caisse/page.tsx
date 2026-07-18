'use client'

import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, CreditCard, Lock, Minus, Plus, ScanLine, Search, ShoppingCart, Trash2, Wallet } from 'lucide-react'
import MobileShell from '@/components/MobileShell'
import CameraScanner from '@/components/CameraScanner'
import ProductImage from '@/components/ProductImage'
import { availableStock, fmtDH, useDroguerie, type Client, type Sale, type SaleItem } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type Pay = 'especes' | 'carte' | 'credit'

function Content() {
  const { ready, products, clients, currentSession, openSession, recordSale } = useDroguerie()
  const { t } = useLanguage()

  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<SaleItem[]>([])
  const [clientId, setClientId] = useState('')
  const [pay, setPay] = useState<Pay>('especes')
  const [openFund, setOpenFund] = useState('0')
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [flash, setFlash] = useState('')

  const inCart = (id: string) => cart.find((i) => i.productId === id)?.qty ?? 0
  const total = useMemo(() => cart.reduce((a, i) => a + i.price * i.qty, 0), [cart])

  if (!ready) return <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-400">…</div>

  // Register must be open for the active store.
  if (!currentSession) {
    return (
      <section className="mt-10 rounded-2xl m-card p-6 backdrop-blur-xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
            <Lock className="h-7 w-7" />
          </span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('mob_pos_closed_title')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('mob_pos_closed_desc')}</p>
        </div>
        <label className="mt-6 block">
          <span className="mb-1.5 block text-xs font-semibold text-sky-400/80">{t('mob_pos_open_fund')}</span>
          <input
            type="number"
            inputMode="decimal"
            value={openFund}
            onChange={(e) => setOpenFund(e.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 dark:border-sky-500/20 bg-slate-100 dark:bg-white/5 px-4 text-lg font-bold text-slate-900 dark:text-white outline-none focus:border-sky-400/60"
          />
        </label>
        <button
          onClick={() => openSession(Math.max(0, parseFloat(openFund.replace(',', '.')) || 0))}
          className="mt-4 h-12 w-full rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-500 font-bold text-slate-900 transition active:scale-[0.98]"
        >
          {t('mob_pos_open')}
        </button>
      </section>
    )
  }

  // Success screen after a sale.
  if (lastSale) {
    return (
      <motion.section initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-8 text-center backdrop-blur-xl">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
          <Check className="h-9 w-9" strokeWidth={2.5} />
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{t('mob_pos_success')}</h2>
        <p className="mt-1 text-3xl font-black text-emerald-300 tabular-nums">{fmtDH(lastSale.total)}</p>
        <button
          onClick={() => setLastSale(null)}
          className="mt-8 h-12 w-full rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-500 font-bold text-slate-900 transition active:scale-[0.98]"
        >
          {t('mob_pos_new')}
        </button>
      </motion.section>
    )
  }

  const q = query.trim().toLowerCase()
  const matches = products
    .filter((p) => availableStock(p) > 0 && (!q || p.name.toLowerCase().includes(q) || p.barcode.includes(q)))
    .slice(0, 30)

  const addToCart = (id: string) => {
    const p = products.find((x) => x.id === id)
    if (!p || inCart(id) >= availableStock(p)) return
    setCart((c) => {
      const ex = c.find((i) => i.productId === id)
      return ex ? c.map((i) => (i.productId === id ? { ...i, qty: i.qty + 1 } : i)) : [...c, { productId: p.id, name: p.name, price: p.price, qty: 1 }]
    })
  }
  const changeQty = (id: string, delta: number) => {
    const p = products.find((x) => x.id === id)
    setCart((c) =>
      c.flatMap((i) => {
        if (i.productId !== id) return [i]
        const q2 = i.qty + delta
        if (q2 <= 0) return []
        if (p && q2 > availableStock(p)) return [i]
        return [{ ...i, qty: q2 }]
      })
    )
  }
  const removeItem = (id: string) => setCart((c) => c.filter((i) => i.productId !== id))

  const onScan = (code: string) => {
    const p = products.find((x) => x.barcode && x.barcode === code.trim())
    if (!p) {
      setFlash(t('mob_inv_not_found'))
    } else if (availableStock(p) <= 0) {
      setFlash(`${p.name} — 0`)
    } else {
      addToCart(p.id)
      setFlash(`${p.name} +1`)
    }
    setTimeout(() => setFlash(''), 1600)
  }

  const client: Client | null = clients.find((c) => c.id === clientId) ?? null
  const needClient = pay === 'credit' && !client
  const canCharge = cart.length > 0 && !needClient

  const charge = () => {
    if (!canCharge) return
    const sale = recordSale(cart, pay, client)
    setCart([])
    setClientId('')
    setPay('especes')
    setLastSale(sale)
  }

  const PAY_OPTS: { key: Pay; label: string; icon: React.ReactNode }[] = [
    { key: 'especes', label: t('mob_pos_pay_cash'), icon: <Wallet className="h-4 w-4" /> },
    { key: 'carte', label: t('mob_pos_pay_card'), icon: <CreditCard className="h-4 w-4" /> },
    { key: 'credit', label: t('mob_pos_pay_credit'), icon: <ShoppingCart className="h-4 w-4" /> },
  ]

  return (
    <>
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('mob_pos_title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('mob_pos_subtitle')}</p>
      </motion.section>

      {/* Search + scan */}
      <section className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('mob_pos_search')}
            className="h-11 w-full rounded-2xl border border-slate-200 dark:border-sky-500/20 bg-slate-100 dark:bg-white/5 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-400/60"
          />
        </div>
        <button
          onClick={() => setScanOpen(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 text-slate-900 shadow-[0_4px_16px_rgba(14,165,233,0.4)] transition active:scale-90"
          aria-label={t('mob_scan')}
        >
          <ScanLine className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </section>

      {flash && (
        <p className="rounded-xl border border-sky-500/30 bg-sky-500/10 py-2 text-center text-sm font-semibold text-sky-600 dark:text-sky-200">{flash}</p>
      )}

      <CameraScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetect={onScan} />

      {/* Product results */}
      <section className="grid grid-cols-2 gap-3">
        {matches.map((p) => (
          <button
            key={p.id}
            onClick={() => addToCart(p.id)}
            className="flex flex-col overflow-hidden rounded-2xl m-card text-left backdrop-blur-xl transition active:scale-[0.97]"
          >
            <div className="relative aspect-[5/3] w-full overflow-hidden bg-white dark:bg-slate-900/60">
              <ProductImage image={p.image} category={p.category} alt={p.name} fit={p.image ? 'contain' : 'cover'} iconSize="h-7 w-7" className={p.image ? 'p-2' : ''} />
              <span className="absolute bottom-1.5 left-1.5 rounded-md bg-sky-500/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">{availableStock(p)}</span>
            </div>
            <div className="p-2.5">
              <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{p.name}</p>
              <p className="mt-0.5 text-sm font-bold text-sky-300 tabular-nums">{fmtDH(p.price)}</p>
            </div>
          </button>
        ))}
      </section>

      {/* Cart */}
      <section className="rounded-2xl m-card p-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white"><ShoppingCart className="h-4 w-4 text-sky-400" />{t('mob_pos_cart')}</h3>
          {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs font-semibold text-rose-400">✕</button>}
        </div>
        {cart.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">{t('mob_pos_empty')}</p>
        ) : (
          <div className="space-y-2.5">
            {cart.map((i) => (
              <div key={i.productId} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{i.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{fmtDH(i.price)} × {i.qty}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => changeQty(i.productId, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="w-6 text-center text-sm font-bold text-slate-900 dark:text-white tabular-nums">{i.qty}</span>
                  <button onClick={() => changeQty(i.productId, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white"><Plus className="h-3.5 w-3.5" /></button>
                  <button onClick={() => removeItem(i.productId)} className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Client + payment + charge */}
      <section className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-sky-400/80">{t('mob_pos_client')}</p>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-200 dark:border-sky-500/20 bg-slate-100 dark:bg-white/5 px-3 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400/60"
          >
            <option value="" className="bg-white dark:bg-slate-900">{t('mob_pos_client_none')}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900">{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-sky-400/80">{t('mob_pos_pay')}</p>
          <div className="grid grid-cols-3 gap-2">
            {PAY_OPTS.map((o) => (
              <button
                key={o.key}
                onClick={() => setPay(o.key)}
                className={`flex flex-col items-center gap-1 rounded-2xl border py-3 text-xs font-semibold transition ${
                  pay === o.key ? 'border-sky-400/60 bg-sky-500/15 text-sky-300' : 'border-slate-200 dark:border-sky-500/20 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                }`}
              >
                {o.icon}
                {o.label}
              </button>
            ))}
          </div>
          {needClient && <p className="mt-2 text-xs font-semibold text-amber-400">{t('mob_pos_need_client')}</p>}
        </div>

        <button
          onClick={charge}
          disabled={!canCharge}
          className="flex h-14 w-full items-center justify-between rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-500 px-5 font-bold text-slate-900 transition active:scale-[0.98] disabled:opacity-40"
        >
          <span>{t('mob_pos_charge')}</span>
          <span className="text-lg tabular-nums">{fmtDH(total)}</span>
        </button>
      </section>
    </>
  )
}

export default function MobileCaissePage() {
  return (
    <MobileShell>
      <Content />
    </MobileShell>
  )
}
