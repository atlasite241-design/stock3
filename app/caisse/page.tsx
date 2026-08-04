'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Loader from '@/components/Loader'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Banknote,
  Barcode,
  Camera,
  CreditCard,
  Layers,
  MapPin,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
  ZoomIn,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import EAN13 from '@/components/EAN13'
import ProductImage from '@/components/ProductImage'
import Modal from '@/components/Modal'
import CameraScanner from '@/components/CameraScanner'
import PaymentModal from '@/components/PaymentModal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import {
  availableStock,
  fmtDH,
  loadHeldSales,
  PAYMENT_META,
  saveHeldSales,
  useDroguerie,
  uid,
  baseQty,
  roundQty,
  type HeldSale,
  type Product,
  type Client,
  type Sale,
  type SaleItem,
  type SaleUnit,
} from '@/lib/store'
import { playSound } from '@/lib/sound'
import { useLanguage } from '@/lib/i18n'

const ticketNumber = (s: Sale) => `V${s.id.slice(-8).toUpperCase()}`

/**
 * Quantite affichee sur le ticket : entiere quand elle l'est.
 * « 3.00 vis » n'a pas de sens ; « 7.5 m » de cable, si. Les decimales ne
 * s'affichent donc que lorsqu'il y en a reellement.
 */
const fmtQty = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)))

/**
 * Colonnes du ticket, definies une seule fois.
 * L'en-tete et les lignes doivent porter EXACTEMENT les memes largeurs, sinon
 * « Qté » ne tombe pas au-dessus de la quantite. Les separer invitait la derive.
 */
const TCOL = {
  row: 'flex justify-between gap-1',
  qty: 'w-8 shrink-0 tabular-nums',
  name: 'min-w-0 flex-1 px-1',
  pu: 'w-14 shrink-0 text-right tabular-nums',
  pt: 'w-14 shrink-0 text-right tabular-nums',
}

const ticketBarcode = (s: Sale) => {
  let n = ''
  for (const ch of s.id) n += ch.charCodeAt(0) % 10
  return (n + '000000000000').slice(0, 12)
}

function CaisseContent() {
  const { ready, products, clients, settings, depots, activeStoreId, recordSale, currentSession, openSession } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [cart, setCart] = useState<SaleItem[]>([])
  const [category, setCategory] = useState('Tous')
  const [query, setQuery] = useState('')
  const [payment, setPayment] = useState<Sale['payment']>('especes')
  const [clientId, setClientId] = useState('')
  const [saleDepotId, setSaleDepotId] = useState('')
  // Dépôts du magasin actif (pour vendre depuis un dépôt donné).
  const storeDepots = useMemo(() => depots.filter((d) => d.storeId === activeStoreId), [depots, activeStoreId])
  // Restaure le dépôt de caisse choisi (persistant entre sessions).
  useEffect(() => {
    try { const v = localStorage.getItem('dp_pos_depot'); if (v) setSaleDepotId(v) } catch {}
  }, [])
  const [receipt, setReceipt] = useState<Sale | null>(null)
  // Espèces remises par le client (pour calculer le rendu affiché sur le ticket).
  const [receiptReceived, setReceiptReceived] = useState<number | undefined>(undefined)
  const [zoomProduct, setZoomProduct] = useState<Product | null>(null)
  const [creditWarn, setCreditWarn] = useState<{ received?: number; after: number; client: Client } | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [held, setHeld] = useState<HeldSale[]>([])
  const [resumeOpen, setResumeOpen] = useState(false)
  const [openCaisseModal, setOpenCaisseModal] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('500')
  const [cartSheetOpen, setCartSheetOpen] = useState(false)
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false)
  const barcodeRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const lastQuery = useRef('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    setHeld(loadHeldSales())
  }, [])

  // Broadcast cart state so the sidebar can enable/disable "Suspendre une vente"
  useEffect(() => {
    const count = cart.reduce((a, i) => a + i.qty, 0)
    sessionStorage.setItem('dp_cart_count', String(count))
    window.dispatchEvent(new Event('droguerie-cart-change'))
    return () => {
      sessionStorage.setItem('dp_cart_count', '0')
      window.dispatchEvent(new Event('droguerie-cart-change'))
    }
  }, [cart])

  /**
   * Un même article peut figurer plusieurs fois dans le panier, une ligne par
   * conditionnement : 5 pièces ET 1 boîte. L'identité d'une ligne est donc le
   * couple produit + conditionnement, pas le produit seul.
   */
  const lineKey = (productId: string, unitName?: string) => `${productId}|${unitName ?? ''}`

  /** Quantité déjà au panier pour ce produit, exprimée en unités de STOCK. */
  const inCartBase = (id: string) =>
    cart.filter((i) => i.productId === id).reduce((s, i) => s + baseQty(i), 0)

  const addToCart = (p: Product, unit?: SaleUnit) => {
    // Sellable stock excludes quantities reserved by pending transfers.
    const avail = availableStock(p)
    const pas = unit ? unit.factor : 1
    if (avail <= 0) {
      toast(`${p.name} — ${t('pos_toast_out_of_stock')}`, 'error')
      return
    }
    // Le contrôle porte sur l'unité de stock : ajouter une boîte de 100 exige
    // 100 pièces disponibles, pas une.
    if (inCartBase(p.id) + pas > avail) {
      toast(`${t('pos_toast_insufficient_stock')} — ${p.name} (${avail} ${t('pos_toast_available')})`, 'error')
      return
    }
    const key = lineKey(p.id, unit?.name)
    setCart((c) => {
      const ex = c.find((i) => lineKey(i.productId, i.unitName) === key)
      return ex
        ? c.map((i) => (lineKey(i.productId, i.unitName) === key ? { ...i, qty: i.qty + 1 } : i))
        : [...c, {
            productId: p.id,
            name: p.name,
            price: unit ? unit.price : p.price,
            qty: 1,
            unitName: unit?.name,
            unitFactor: unit?.factor,
          }]
    })
    toast(`✓ ${p.name}${unit ? ` — ${unit.name}` : ''} ${t('pos_toast_added')}`)
  }

  const handleScan = (code: string) => {
    const c = code.trim()
    if (!c) return
    // Le code identifie l'UNITÉ, pas seulement l'article : scanner le carton
    // doit ajouter un carton, pas une pièce.
    const byUnit = unitByBarcode.get(c)
    if (byUnit) {
      addToCart(byUnit.p, byUnit.u)
      return
    }
    const p = prodByBarcode.get(c)
    if (!p) {
      toast(`${t('pos_toast_product_not_found')} ${c}`, 'error')
      return
    }
    addToCart(p)
  }

  const handleScanRef = useRef(handleScan)
  handleScanRef.current = handleScan

  useEffect(() => {
    if (!ready) return
    const consume = () => {
      const code = sessionStorage.getItem('pendingScan')
      if (code) {
        sessionStorage.removeItem('pendingScan')
        handleScanRef.current(code)
      }
    }
    consume()
    window.addEventListener('droguerie-scan', consume)
    return () => window.removeEventListener('droguerie-scan', consume)
  }, [ready])

  useEffect(() => {
    if (ready) barcodeRef.current?.focus()
  }, [ready])

  // Deep-link support from the sidebar "Point de vente (POS)" submenu
  useEffect(() => {
    if (!ready) return
    const qs = searchParams.toString()
    if (!qs || qs === lastQuery.current) return
    lastQuery.current = qs
    if (searchParams.get('camera') === '1') setCameraOpen(true)
    if (searchParams.get('focus') === 'search') setTimeout(() => searchRef.current?.focus(), 50)
    if (searchParams.get('payment') === 'mixte') setPayment('mixte')
    if (searchParams.get('resume') === '1' && held.length > 0) setResumeOpen(true)
    if (searchParams.get('suspend') === '1') {
      if (cart.length > 0) holdSale()
      else toast(t('pos_toast_empty_cart_suspend'), 'error')
    }
    router.replace('/caisse', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, held, cart, searchParams])

  const categories = useMemo(
    () => ['Tous', ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  )

  // Index O(1) par id / code-barres : indispensable avec un gros catalogue,
  // sinon chaque rendu du panier refait un find() sur tout le catalogue.
  const prodById = useMemo(() => {
    const m = new Map<string, (typeof products)[number]>()
    for (const p of products) m.set(p.id, p)
    return m
  }, [products])

  const prodByBarcode = useMemo(() => {
    const m = new Map<string, (typeof products)[number]>()
    for (const p of products) {
      if (p.barcode) m.set(p.barcode, p)
      // Codes-barres absorbés lors d'une fusion de doublons : les étiquettes
      // déjà collées en rayon doivent continuer à fonctionner.
      for (const b of p.altBarcodes ?? []) if (b && !m.has(b)) m.set(b, p)
    }
    return m
  }, [products])

  /** Codes-barres des conditionnements (carton, boîte), distincts de celui de la pièce. */
  const unitByBarcode = useMemo(() => {
    const m = new Map<string, { p: Product; u: SaleUnit }>()
    for (const p of products) {
      for (const u of p.saleUnits ?? []) {
        if (u.barcode) m.set(u.barcode.trim(), { p, u })
      }
    }
    return m
  }, [products])

  // Clé de recherche pré-calculée + recherche différée : la frappe reste fluide
  // (avant : un toLowerCase() sur tout le catalogue à chaque caractère).
  const searchIndex = useMemo(
    () => products.map((p) => ({ p, key: `${p.name} ${p.barcode}`.toLowerCase() })),
    [products]
  )
  const deferredQuery = useDeferredValue(query)

  // On n'affiche qu'un nombre limité de cartes : rendre les 25 000 fiches (chacune
  // avec une image) figeait la caisse plusieurs minutes. La caisse s'utilise au
  // scan / à la recherche — au-delà, on invite à préciser.
  const MAX_CARDS = 60
  const { filtered, totalMatches } = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const out: typeof products = []
    let total = 0
    for (const it of searchIndex) {
      if (category !== 'Tous' && it.p.category !== category) continue
      if (q && !it.key.includes(q)) continue
      total++
      if (out.length < MAX_CARDS) out.push(it.p)
    }
    return { filtered: out, totalMatches: total }
  }, [searchIndex, deferredQuery, category])

  const changeQty = (key: string, delta: number) => {
    setCart((c) =>
      c.flatMap((i) => {
        if (lineKey(i.productId, i.unitName) !== key) return [i]
        const q = i.qty + delta
        if (q <= 0) return []
        const p = prodById.get(i.productId)
        // Le plafond s'évalue en unités de stock, toutes lignes du même produit
        // confondues : 5 pièces + 1 boîte de 100 pèsent 105 sur le stock.
        if (p) {
          const autres = c
            .filter((x) => x.productId === i.productId && lineKey(x.productId, x.unitName) !== key)
            .reduce((s, x) => s + baseQty(x), 0)
          if (autres + baseQty({ qty: q, unitFactor: i.unitFactor }) > availableStock(p)) return [i]
        }
        return [{ ...i, qty: q }]
      })
    )
  }

  /**
   * Saisie directe — indispensable dès qu'on vend au mètre ou au kilo : atteindre
   * 7,5 m avec un bouton « +1 » n'a pas de sens.
   */
  const setQty = (key: string, raw: number) => {
    setCart((c) =>
      c.flatMap((i) => {
        if (lineKey(i.productId, i.unitName) !== key) return [i]
        const q = roundQty(Math.max(0, raw))
        if (q <= 0) return [i] // la suppression passe par la corbeille, pas par un zéro accidentel
        const p = prodById.get(i.productId)
        if (p) {
          const autres = c
            .filter((x) => x.productId === i.productId && lineKey(x.productId, x.unitName) !== key)
            .reduce((s, x) => s + baseQty(x), 0)
          if (autres + baseQty({ qty: q, unitFactor: i.unitFactor }) > availableStock(p)) {
            toast(`${t('pos_toast_insufficient_stock')} — ${i.name}`, 'error')
            return [i]
          }
        }
        return [{ ...i, qty: q }]
      })
    )
  }

  const removeItem = (key: string) => setCart((c) => c.filter((i) => lineKey(i.productId, i.unitName) !== key))

  const total = cart.reduce((a, i) => a + i.price * i.qty, 0)

  const holdSale = () => {
    if (cart.length === 0) return
    const h: HeldSale = {
      id: uid(),
      date: new Date().toISOString(),
      items: cart,
      clientId,
      label: `${cart.reduce((a, i) => a + i.qty, 0)} ${t('dash_articles_abbr')} — ${fmtDH(total)}`,
    }
    const next = [h, ...held]
    setHeld(next)
    saveHeldSales(next)
    setCart([])
    setClientId('')
    setCartSheetOpen(false)
    toast(t('pos_toast_sale_suspended'))
    barcodeRef.current?.focus()
  }

  const resumeSale = (h: HeldSale) => {
    setCart(h.items)
    setClientId(h.clientId)
    const next = held.filter((x) => x.id !== h.id)
    setHeld(next)
    saveHeldSales(next)
    setResumeOpen(false)
    toast(t('pos_toast_sale_resumed'))
  }

  const finalize = (receivedAmount?: number, override = false) => {
    if (cart.length === 0) return
    if (!currentSession) {
      toast(t('pos_open_register_required'), 'error')
      setPaymentSheetOpen(false)
      setOpenCaisseModal(true)
      return
    }
    const client = clients.find((c) => c.id === clientId) ?? null
    if (payment === 'credit') {
      if (!client) {
        toast(t('pos_toast_select_client_credit'), 'error')
        return
      }
      if (client.creditAllowed === false) {
        toast(t('pos_credit_not_allowed'), 'error')
        return
      }
      const cartTotal = cart.reduce((a, i) => a + i.price * i.qty, 0)
      if (!override && client.creditLimit > 0 && client.credit + cartTotal > client.creditLimit) {
        setCreditWarn({ received: receivedAmount, after: client.credit + cartTotal, client })
        return
      }
    }
    const sale = recordSale(cart, payment, client, saleDepotId || undefined)
    playSound('cash')
    setReceipt(sale)
    setReceiptReceived(payment === 'especes' ? receivedAmount : undefined)
    setCart([])
    setClientId('')
    setPayment('especes')
    setCartSheetOpen(false)
    setPaymentSheetOpen(false)
    if (receivedAmount !== undefined && payment === 'especes' && receivedAmount > sale.total) {
      toast(`${t('pos_toast_change_due')} ${fmtDH(receivedAmount - sale.total)}`)
    }
    if (client) {
      const pts = Math.floor(sale.total / 50)
      if (pts > 0) toast(`⭐ ${client.name} ${t('pos_toast_loyalty_points')} ${pts} ${t('pos_toast_loyalty_point_suffix')}`)
    }
  }

  const closeReceipt = () => {
    setReceipt(null)
    barcodeRef.current?.focus()
  }

  if (!ready) {
    return <Loader />
  }

  const paymentOptions: { key: Sale['payment']; label: string; icon: typeof Banknote }[] = [
    { key: 'especes', label: t('pos_pay_especes'), icon: Banknote },
    { key: 'carte', label: t('pos_pay_carte'), icon: CreditCard },
    { key: 'credit', label: t('pos_pay_credit'), icon: Wallet },
    { key: 'mixte', label: t('pos_pay_mixte'), icon: Layers },
  ]

  const cartItemCount = cart.reduce((a, i) => a + i.qty, 0)

  const cartPanel = (
    <>
      <div className="flex items-center justify-between lg:hidden">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
          <ShoppingCart className="h-4 w-4 text-amber-500" />
          {t('pos_cart')}
        </h2>
        <span className="rounded-lg bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 tabular-nums">
          {cartItemCount} {t('pos_article_count')}
        </span>
      </div>

      <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[260px]">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ShoppingCart className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-400 dark:text-zinc-500">{t('pos_cart_empty')}</p>
          </div>
        ) : (
          cart.map((i) => {
            const prod = prodById.get(i.productId)
            const key = lineKey(i.productId, i.unitName)
            const units = prod?.saleUnits ?? []
            return (
            <div key={key} className="rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 p-3">
              <div className="flex items-start gap-2.5">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-black">
                  <ProductImage image={prod?.image} category={prod?.category ?? ''} alt={i.name} iconSize="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{i.name}</p>
                  {i.unitFactor && i.unitFactor > 1 && (
                    <p className="text-[11px] tabular-nums text-amber-600 dark:text-amber-400">
                      {i.unitName} — {i.unitFactor} {prod?.unit ?? ''} · {fmtDH(i.price)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeItem(key)}
                  className="shrink-0 rounded-lg p-2 -m-1 text-gray-400 dark:text-zinc-500 transition hover:bg-rose-50 hover:text-rose-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {/* Changer de conditionnement sans ressortir du panier : le vendeur
                  passe de la pièce à la boîte d'un geste, devant le client. */}
              {units.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {[{ id: '', name: prod?.unit || t('pos_unit_piece'), factor: 1, price: prod?.price ?? i.price } as SaleUnit, ...units].map((u) => {
                    const actif = (i.unitName ?? '') === (u.factor === 1 && !u.id ? '' : u.name)
                    return (
                      <button
                        key={u.id || 'base'}
                        onClick={() => {
                          if (actif || !prod) return
                          removeItem(key)
                          addToCart(prod, u.factor === 1 && !u.id ? undefined : u)
                        }}
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold tabular-nums transition ${
                          actif
                            ? 'bg-amber-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-amber-50 dark:bg-white/10 dark:text-zinc-300'
                        }`}
                      >
                        {u.name}{u.factor > 1 ? ` ×${u.factor}` : ''} · {fmtDH(u.price)}
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => changeQty(key, -1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 transition hover:border-amber-300 hover:bg-amber-50 lg:h-7 lg:w-7"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  {prod?.decimalQty ? (
                    <input
                      type="number" min={0} step="0.01" value={i.qty}
                      onChange={(e) => setQty(key, Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      className="h-9 w-20 rounded-lg border border-gray-200 bg-white px-2 text-center text-sm font-bold tabular-nums text-gray-900 dark:border-white/10 dark:bg-[#12121a] dark:text-white lg:h-7"
                    />
                  ) : (
                    <span className="w-8 text-center text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                      {i.qty}
                    </span>
                  )}
                  {prod?.decimalQty && (
                    <span className="text-[11px] text-gray-400 dark:text-zinc-500">{prod.unit}</span>
                  )}
                  <button
                    onClick={() => changeQty(key, 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 transition hover:border-amber-300 hover:bg-amber-50 lg:h-7 lg:w-7"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(i.price * i.qty)}</p>
              </div>
            </div>
            )
          })
        )}
      </div>

      {/* Payment */}
      <div className="mt-4 border-t border-gray-100 dark:border-white/10 pt-4">
        <p className="field-label">{t('pos_payment_method')}</p>
        <div className="grid grid-cols-4 gap-2">
          {paymentOptions.map((o) => (
            <button
              key={o.key}
              onClick={() => setPayment(o.key)}
              className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-semibold transition ${
                payment === o.key
                  ? 'border-amber-400 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300'
                  : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-500 dark:text-zinc-400 hover:border-amber-200'
              }`}
            >
              <o.icon className="h-4 w-4" />
              {o.label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <p className="field-label">
            {t('pos_client_label')}{' '}
            {payment === 'credit' ? <span className="text-rose-500 dark:text-rose-400">{t('pos_client_required')}</span> : t('pos_client_optional')}
          </p>
          <Select
            value={clientId}
            onChange={setClientId}
            placeholder={t('pos_no_client')}
            options={[
              { value: '', label: t('pos_no_client') },
              ...clients.map((c) => ({ value: c.id, label: `${c.name} (${c.points} ${t('pos_points_abbr')})` })),
            ]}
          />
        </div>

        {storeDepots.length > 0 && (
          <div className="mt-3">
            <p className="field-label">{t('pos_depot_label')}</p>
            <Select
              value={saleDepotId}
              onChange={(v) => { setSaleDepotId(v); try { localStorage.setItem('dp_pos_depot', v) } catch {} }}
              placeholder={t('pos_depot_none')}
              options={[{ value: '', label: t('pos_depot_none') }, ...storeDepots.map((d) => ({ value: d.id, label: d.name }))]}
            />
          </div>
        )}

        <p className="mt-3 text-xs text-gray-400 dark:text-zinc-500">
          {t('pos_received_hint')}
        </p>
      </div>

      {/* Total */}
      <div className="mt-4 rounded-xl bg-gradient-to-r from-amber-50 dark:from-amber-500/10 to-yellow-50 dark:to-yellow-500/5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400">{t('pos_total')}</span>
          <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white tabular-nums">
            {fmtDH(total)}
          </span>
        </div>
      </div>

      <button
        onClick={() => {
          if (!currentSession) {
            toast(t('pos_open_register_required'), 'error')
            setOpenCaisseModal(true)
            return
          }
          if (payment === 'credit' && !clientId) {
            toast(t('pos_toast_select_client_credit'), 'error')
            return
          }
          setPaymentSheetOpen(true)
        }}
        disabled={cart.length === 0}
        className="btn-primary mt-4 h-12 w-full text-base"
      >
        {t('pos_checkout')} {total > 0 ? fmtDH(total) : ''}
      </button>
    </>
  )

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            {t('pos_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('pos_subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {held.length > 0 && (
            <button onClick={() => setResumeOpen(true)} className="btn-secondary">
              <PlayCircle className="h-4 w-4 text-amber-500" />
              {t('pos_resume')} ({held.length})
            </button>
          )}
          <button onClick={holdSale} disabled={cart.length === 0} className="btn-secondary disabled:opacity-50">
            <PauseCircle className="h-4 w-4" />
            {t('pos_suspend')}
          </button>
        </div>
      </motion.div>

      {/* Register status banner */}
      {!currentSession && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-5 py-3.5">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {t('pos_register_closed_warning')}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setOpenCaisseModal(true)} className="btn-primary !h-9 text-xs">
              {t('pos_open_register')}
            </button>
            <Link href="/caisse-journal" className="btn-secondary !h-9 text-xs">
              {t('pos_cash_journal')}
            </Link>
          </div>
        </div>
      )}

      <div className="grid items-start gap-6 pb-24 lg:grid-cols-[1fr_380px] lg:pb-0">
        {/* LEFT — products */}
        <div className="space-y-4">
          {/* Barcode scanner input */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
            className="glass-card border-amber-300 dark:border-amber-500/30 p-4 shadow-glow"
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-500" />
                <input
                  ref={barcodeRef}
                  type="text"
                  placeholder={t('pos_scan_placeholder')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleScan(e.currentTarget.value)
                      e.currentTarget.value = ''
                    }
                  }}
                  className="h-12 w-full rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-white/5 pl-11 pr-4 text-base font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 outline-none transition focus:border-amber-400 focus:bg-white dark:focus:bg-white/[0.08] focus:ring-2 focus:ring-amber-400/25"
                />
              </div>
              <button
                onClick={() => setCameraOpen(true)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-200 dark:border-amber-500/20 bg-white dark:bg-[#12121a] text-amber-500 transition hover:bg-amber-50"
                title={t('pos_camera_title')}
              >
                <Camera className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
              {t('pos_usb_hint_prefix')}{' '}
              <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">6118000040972</span> (Javel 5L)
            </p>
          </motion.div>

          {/* Search + categories */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
              <input
                type="text"
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('pos_search_placeholder')}
                className="input-field pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                    category === c
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/25'
                      : 'border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 hover:border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  {c === 'Tous' ? t('pos_all_categories') : c}
                </button>
              ))}
            </div>
          </div>

          {/* Product grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={availableStock(p) <= 0}
                className="group glass-card glass-card-hover overflow-hidden p-0 text-left disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#eef2f7,#d6dee8)] dark:bg-[radial-gradient(circle_at_50%_35%,#1b2a3a,#080b12)]">
                  <ProductImage
                    image={p.image}
                    category={p.category}
                    alt={p.name}
                    iconSize="h-9 w-9"
                    fit={p.image ? 'contain' : 'cover'}
                    className={p.image ? 'p-2.5 transition-transform duration-300 group-hover:scale-110' : 'transition-transform duration-300 group-hover:scale-110'}
                  />
                  {p.image && (
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation()
                        setZoomProduct(p)
                      }}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 backdrop-blur-sm transition hover:bg-black/70 group-hover:opacity-100"
                      title={t('pos_zoom_image')}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </span>
                  )}
                  <span className="absolute left-2 top-2 truncate rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                    {p.category}
                  </span>
                  <span
                    className={`absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      availableStock(p) === 0
                        ? 'bg-rose-500/90 text-white'
                        : availableStock(p) <= p.minStock
                          ? 'bg-amber-500/90 text-gray-900'
                          : 'bg-emerald-500/90 text-white'
                    }`}
                  >
                    {availableStock(p) === 0 ? t('pos_out_of_stock_badge') : `${availableStock(p)} ${t('pos_in_stock_badge')}`}
                  </span>
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 min-h-[40px] text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                  {p.emplacementComplet && (
                    <p className="mt-0.5 flex items-center gap-0.5 truncate font-mono text-[10px] text-amber-600 dark:text-amber-400">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />{p.emplacementComplet}
                    </p>
                  )}
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <p className="text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums">{fmtDH(p.price)}</p>
                    {p.barcode && <span className="shrink-0 truncate text-[10px] text-gray-400 dark:text-zinc-500">{p.barcode.slice(-8)}</span>}
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('pos_no_product_found')}</p>
            )}
          </div>
          {totalMatches > MAX_CARDS && (
            <p className="mt-3 text-center text-xs text-gray-400 dark:text-zinc-500">
              {t('pos_showing_first')} {MAX_CARDS} {t('pos_of')} {totalMatches} — {t('pos_refine_search')}
            </p>
          )}
        </div>

        {/* RIGHT — cart (desktop / tablet landscape sidebar) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="glass-card hidden p-5 lg:sticky lg:top-20 lg:block"
        >
          <div className="hidden items-center justify-between lg:flex">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
              <ShoppingCart className="h-4 w-4 text-amber-500" />
              {t('pos_cart')}
            </h2>
            <span className="rounded-lg bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 tabular-nums">
              {cartItemCount} {t('pos_article_count')}
            </span>
          </div>
          <div className="mt-4">{cartPanel}</div>
        </motion.div>
      </div>

      {/* Mobile / tablet portrait — floating cart bar, opens the cart as a bottom sheet */}
      {cart.length > 0 && (
        <button
          onClick={() => setCartSheetOpen(true)}
          className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between gap-3 rounded-2xl bg-gray-900 px-5 py-4 text-white shadow-2xl lg:hidden"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="h-5 w-5 text-amber-400" />
            {cartItemCount} {t('pos_article_count')}
          </span>
          <span className="flex items-center gap-2 text-base font-bold tabular-nums">
            {fmtDH(total)}
            <span className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-gray-900 dark:text-white">
              {t('pos_view_cart')}
            </span>
          </span>
        </button>
      )}

      <Modal open={cartSheetOpen} onClose={() => setCartSheetOpen(false)} title={t('pos_cart')} maxWidth="max-w-lg">
        {cartPanel}
      </Modal>

      {/* Checkout / payment screen */}
      <PaymentModal
        open={paymentSheetOpen}
        onClose={() => setPaymentSheetOpen(false)}
        total={total}
        payment={payment}
        onPaymentChange={setPayment}
        clientSelected={!!clientId}
        onConfirm={(receivedAmount) => finalize(receivedAmount)}
      />

      {/* Camera scanner */}
      <CameraScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onDetect={(code) => handleScan(code)} />

      {/* Resume held sales */}
      <Modal open={resumeOpen} onClose={() => setResumeOpen(false)} title={t('pos_suspended_sales')} maxWidth="max-w-sm">
        <div className="space-y-2">
          {held.map((h) => (
            <button
              key={h.id}
              onClick={() => resumeSale(h)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 px-4 py-3 text-left transition hover:border-amber-300 hover:bg-amber-50"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{h.label}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  {new Date(h.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <PlayCircle className="h-5 w-5 shrink-0 text-amber-500" />
            </button>
          ))}
          {held.length === 0 && <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-500">{t('pos_no_suspended')}</p>}
        </div>
      </Modal>

      {/* Open register */}
      <Modal open={openCaisseModal} onClose={() => setOpenCaisseModal(false)} title={t('pos_open_register')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">{t('pos_register_amount_hint')}</p>
        <div className="mt-4">
          <label className="field-label">{t('pos_cash_float')}</label>
          <input
            type="number"
            min="0"
            value={openingAmount}
            onChange={(e) => setOpeningAmount(e.target.value)}
            className="input-field"
            autoFocus
          />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setOpenCaisseModal(false)} className="btn-secondary">
            {t('pos_cancel')}
          </button>
          <button
            onClick={() => {
              openSession(parseFloat(openingAmount.replace(',', '.')) || 0)
              setOpenCaisseModal(false)
            }}
            className="btn-primary"
          >
            {t('pos_open')}
          </button>
        </div>
      </Modal>

      {/* Image zoom (lightbox) */}
      <Modal open={!!zoomProduct} onClose={() => setZoomProduct(null)} title={zoomProduct?.name ?? ''} maxWidth="max-w-2xl">
        {zoomProduct && (
          <div>
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-gray-100 dark:bg-black">
              {zoomProduct.image ? (
                <img src={zoomProduct.image} alt={zoomProduct.name} className="max-h-full max-w-full object-contain" />
              ) : (
                <ProductImage image={undefined} category={zoomProduct.category} iconSize="h-24 w-24" />
              )}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{zoomProduct.name}</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400">{zoomProduct.category}</p>
              </div>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{fmtDH(zoomProduct.price)}</p>
            </div>
            <button
              onClick={() => {
                if (availableStock(zoomProduct) > 0) addToCart(zoomProduct)
                setZoomProduct(null)
              }}
              disabled={availableStock(zoomProduct) <= 0}
              className="btn-primary mt-4 w-full disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {t('pos_add_to_cart')}
            </button>
          </div>
        )}
      </Modal>

      {/* Credit over-limit warning */}
      <Modal open={!!creditWarn} onClose={() => setCreditWarn(null)} title={t('pos_credit_over_title')} maxWidth="max-w-sm">
        {creditWarn && (
          <>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <p className="text-sm text-gray-600 dark:text-zinc-400">{t('pos_credit_over_desc')}</p>
            </div>
            <div className="mt-4 space-y-1 rounded-xl bg-gray-50/60 dark:bg-white/5 p-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500 dark:text-zinc-400">{t('pos_credit_current')}</span><span className="tabular-nums text-gray-900 dark:text-white">{fmtDH(creditWarn.client.credit)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-zinc-400">{t('pos_credit_limit')}</span><span className="tabular-nums text-gray-900 dark:text-white">{fmtDH(creditWarn.client.creditLimit)}</span></div>
              <div className="flex justify-between border-t border-gray-100 dark:border-white/10 pt-1 font-bold"><span className="text-gray-600 dark:text-zinc-300">{t('pos_credit_after')}</span><span className="tabular-nums text-rose-600 dark:text-rose-400">{fmtDH(creditWarn.after)}</span></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setCreditWarn(null)} className="btn-secondary">{t('pos_credit_cancel')}</button>
              <button
                onClick={() => {
                  const received = creditWarn.received
                  setCreditWarn(null)
                  finalize(received, true)
                }}
                className="btn-danger"
              >
                {t('pos_credit_override')}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Receipt modal */}
      <Modal open={!!receipt} onClose={closeReceipt} title={t('pos_sale_recorded')} maxWidth="max-w-sm">
        {receipt && (
          <>
            <div className="print-area rounded-xl border border-gray-200 dark:border-white/15 bg-white p-4 font-mono text-[11px] text-gray-900">
              <div className="flex items-center justify-center gap-2">
                <ShoppingCart className="h-6 w-6 shrink-0" />
                <p className="text-2xl font-black uppercase tracking-tight">{settings.storeName}</p>
              </div>

              <div className="my-3 border-t border-dashed border-gray-300" />

              <p className="text-center leading-snug text-gray-700">{settings.address}</p>
              <p className="text-center leading-snug text-gray-700">{settings.phone}</p>
              <p className="mt-2 text-center text-sm font-bold">{t('posr_sale_label')}</p>

              <div className="my-3 border-t border-dashed border-gray-300" />

              <div className="flex justify-between text-gray-700">
                <span>
                  {t('posr_ticket_prefix')} {ticketNumber(receipt)}
                </span>
                <span>
                  {t('posr_date_prefix')} {new Date(receipt.date).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <p className="text-gray-700">
                {t('posr_time_prefix')} {new Date(receipt.date).toLocaleTimeString('fr-FR')}
              </p>

              <div className="my-3 border-t border-dashed border-gray-300" />

              <div className={`${TCOL.row} font-bold text-gray-800`}>
                <span className={TCOL.qty}>{t('posr_col_qty')}</span>
                <span className={TCOL.name}>{t('posr_col_articles')}</span>
                <span className={TCOL.pu}>{t('posr_col_pu')}</span>
                <span className={TCOL.pt}>{t('posr_col_pt')}</span>
              </div>
              {receipt.items.map((i, n) => (
                // Le conditionnement figure sur le ticket : « 3 » sans « boîtes
                // de 100 » ne permet ni au client ni au commerçant de retrouver
                // ce qui a été vendu.
                <div key={`${i.productId}|${i.unitName ?? ''}|${n}`} className={`mt-1 ${TCOL.row} text-gray-700`}>
                  <span className={TCOL.qty}>{fmtQty(i.qty)}</span>
                  <span className={TCOL.name}>
                    <span className="block truncate">{i.name}</span>
                    {i.unitFactor && i.unitFactor > 1 && (
                      <span className="block truncate text-[9px] opacity-70">{i.unitName} × {i.unitFactor}</span>
                    )}
                  </span>
                  <span className={TCOL.pu}>{i.price.toFixed(2)}</span>
                  <span className={TCOL.pt}>{(i.price * i.qty).toFixed(2)}</span>
                </div>
              ))}

              <div className="my-3 border-t border-dashed border-gray-300" />

              <div className="flex justify-between text-base font-black">
                <span>{t('posr_total_ttc')}</span>
                <span className="tabular-nums">{fmtDH(receipt.total)}</span>
              </div>

              <div className="my-3 border-t border-dashed border-gray-300" />

              <div className="flex justify-between text-gray-600">
                <span>{t('posr_stamp_duty')}</span>
                <span className="tabular-nums">0,00 DH</span>
              </div>
              {(() => {
                // Rendu = espèces reçues − total (0 si paiement exact ou autre mode).
                const tendered = receipt.payment === 'especes' && receiptReceived !== undefined && receiptReceived > receipt.total
                  ? receiptReceived
                  : receipt.total
                const change = Math.max(0, tendered - receipt.total)
                return (
                  <>
                    <div className="mt-1 flex justify-between font-bold uppercase text-amber-600">
                      <span>{PAYMENT_META[receipt.payment].label}</span>
                      <span className="tabular-nums">{fmtDH(tendered)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>{t('posr_change')}</span>
                      <span className="tabular-nums">{fmtDH(change)}</span>
                    </div>
                  </>
                )
              })()}

              <div className="my-3 border-t border-dashed border-gray-300" />

              {/* Ventilation par taux de TVA */}
              <p className="font-bold uppercase text-gray-800">{t('posr_vat_breakdown')}</p>
              <div className="mt-1 flex justify-between font-bold text-gray-700">
                <span className="w-12 shrink-0">{t('posr_vat_rate')}</span>
                <span className="flex-1 text-right">{t('posr_vat_ht')}</span>
                <span className="flex-1 text-right">{t('posr_vat_tva')}</span>
                <span className="flex-1 text-right">{t('posr_vat_ttc')}</span>
              </div>
              {(() => {
                const rate = settings.tva ?? 20
                const ttc = receipt.total
                const ht = ttc / (1 + rate / 100)
                const tva = ttc - ht
                return (
                  <div className="flex justify-between text-gray-700">
                    <span className="w-12 shrink-0 tabular-nums">{rate}%</span>
                    <span className="flex-1 text-right tabular-nums">{ht.toFixed(2)}</span>
                    <span className="flex-1 text-right tabular-nums">{tva.toFixed(2)}</span>
                    <span className="flex-1 text-right tabular-nums">{ttc.toFixed(2)}</span>
                  </div>
                )
              })()}

              <div className="my-3 border-t border-dashed border-gray-300" />

              <p className="text-gray-700">
                {t('posr_items_count')} {fmtQty(receipt.items.reduce((a, i) => a + i.qty, 0))}
              </p>
              <p className="text-gray-700">{t('posr_register_number')} POS01</p>
              <p className="text-gray-700">
                {t('posr_cashier')} {receipt.clientName ? receipt.clientName : 'ADMIN'}
              </p>

              {/* Message configurable dans Paramètres › Impression. */}
              <p className="mt-3 text-center font-semibold">{settings.ticketMessage?.trim() || t('posr_thanks').replace(/\*\*/g, '')}</p>

              <div className="mt-3 space-y-0.5 text-center text-[10px] text-gray-500">
                <p className="font-bold uppercase text-gray-700">{settings.storeName}</p>
                {(settings.cnss || settings.idFiscal) && (
                  <p>
                    {settings.cnss && `${t('posr_cnss')} ${settings.cnss}`}
                    {settings.cnss && settings.idFiscal ? '     ' : ''}
                    {settings.idFiscal && `${t('posr_id_fiscal')}: ${settings.idFiscal}`}
                  </p>
                )}
                {(settings.rcNo || settings.ice) && (
                  <p>
                    {settings.rcNo && `${t('posr_rc')} ${settings.rcNo}`}
                    {settings.rcNo && settings.ice ? '     ' : ''}
                    {settings.ice && `${t('posr_ice')} ${settings.ice}`}
                  </p>
                )}
                {settings.taxePro && (
                  <p>
                    {t('posr_taxe_pro')} {settings.taxePro}
                  </p>
                )}
              </div>

              <div className="mt-3 flex flex-col items-center">
                <EAN13 code={ticketBarcode(receipt)} height={30} moduleWidth={1.3} showText={false} />
                <p className="mt-1 text-[10px] tracking-wider text-gray-600">{ticketNumber(receipt)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => window.print()} className="btn-secondary">
                <Printer className="h-4 w-4" />
                {t('pos_print')}
              </button>
              <button onClick={closeReceipt} className="btn-primary">
                {t('pos_exit')}
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

export default function CaissePage() {
  return (
    <AppShell>
      <CaisseContent />
    </AppShell>
  )
}
