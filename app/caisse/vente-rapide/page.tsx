'use client'

import { useMemo, useState } from 'react'
import JsBarcode from 'jsbarcode'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Printer, Search, Sparkles } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Barcode128 from '@/components/Barcode128'
import { ean13CheckDigit } from '@/components/EAN13'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

// Génère le SVG (chaîne) d'un code-barres CODE128 pour l'impression isolée.
function barcodeSvg(value: string): string {
  try {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    JsBarcode(el, value, { format: 'CODE128', height: 40, width: 1.5, fontSize: 12, displayValue: true, margin: 0, background: '#ffffff', lineColor: '#000000' })
    return el.outerHTML
  } catch {
    return ''
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

// Code-barres EAN-13 dérivé de façon déterministe depuis l'id du client
// (préfixe marocain 611 + 9 chiffres issus d'un hash + clé de contrôle).
function clientEan(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0
  const nine = String(h).padStart(9, '0').slice(-9)
  const base = '611' + nine
  return base + ean13CheckDigit(base)
}

function Content() {
  const { ready, clients, settings } = useDroguerie()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [qty, setQty] = useState<Record<string, number>>({})

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q) || (c.city ?? '').toLowerCase().includes(q))
      .map((c) => ({ c, code: c.code || clientEan(c.id) }))
  }, [clients, query])

  const setAll = (n: number) => {
    const next: Record<string, number> = {}
    rows.forEach(({ c }) => (next[c.id] = n))
    setQty(next)
  }

  const labels = rows.flatMap(({ c, code }) => {
    const n = qty[c.id] ?? 1
    return Array.from({ length: n }, (_, i) => ({ key: `${c.id}-${i}`, client: c, code }))
  })

  // Impression isolée : chaque étiquette = une petite page (≈54×30 mm), sans
  // en-tête/pied navigateur ni page A4 vide. Idéal pour une imprimante d'étiquettes
  // ou à découper. On imprime dans un iframe caché pour ne pas toucher à la page.
  const printLabels = () => {
    if (labels.length === 0) return
    const store = escapeHtml(settings.storeName || 'Droguerie Pro')
    const cells = labels.map(({ client, code }) => `
      <div class="label">
        <div class="store">${store}</div>
        <div class="name">${escapeHtml(client.name)}</div>
        ${barcodeSvg(code)}
      </div>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: 54mm 30mm; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
      html, body { background: #fff; }
      .label { width: 54mm; height: 30mm; display: flex; flex-direction: column;
               align-items: center; justify-content: center; gap: 1mm; padding: 1.5mm;
               page-break-after: always; }
      .store { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
      .name { font-size: 9pt; font-weight: 700; text-align: center; line-height: 1.1; }
      svg { max-width: 100%; height: auto; }
    </style></head><body>${cells}</body></html>`

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (!doc) { document.body.removeChild(iframe); return }
    doc.open(); doc.write(html); doc.close()
    const finish = () => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print() } finally { setTimeout(() => document.body.removeChild(iframe), 1000) } }
    // Laisse le temps aux SVG de se poser.
    setTimeout(finish, 250)
  }

  if (!ready) return <Loader />

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('vr_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('vr_subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setAll(1)} className="btn-secondary !h-9 text-xs">{t('vr_all_1')}</button>
          <button onClick={() => setAll(0)} className="btn-secondary !h-9 text-xs">{t('vr_all_0')}</button>
          <button onClick={printLabels} disabled={labels.length === 0} className="btn-primary disabled:opacity-50">
            <Printer className="h-4 w-4" />
            {t('vr_print')} ({labels.length})
          </button>
        </div>
      </motion.div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('vr_search')} className="input-field pl-10" />
      </div>

      {/* Clients table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('vr_col_client')}</th>
                <th className="px-5 py-3.5">{t('clin_phone')}</th>
                <th className="px-5 py-3.5">{t('cli_col_city')}</th>
                <th className="px-5 py-3.5">{t('vr_col_code')}</th>
                <th className="px-5 py-3.5">{t('vr_col_barcode')}</th>
                <th className="px-5 py-3.5">{t('vr_col_labels')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, code }) => (
                <tr key={c.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {c.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image} alt={c.name} className="h-9 w-9 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-xs font-bold text-gray-900">
                          {c.name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')}
                        </div>
                      )}
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{c.name}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">{c.phone || '—'}</td>
                  <td className="px-5 py-3 text-sm text-gray-600 dark:text-zinc-400">{c.city || '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-600 dark:text-zinc-300 tabular-nums">{c.code || code}</td>
                  <td className="px-5 py-3"><Barcode128 value={code} height={26} width={1.3} fontSize={10} /></td>
                  <td className="px-5 py-3">
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={qty[c.id] ?? 1}
                      onChange={(e) => setQty({ ...qty, [c.id]: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
                      className="input-field !h-9 w-24"
                    />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('vr_no_clients')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Labels preview / print area */}
      {labels.length > 0 && (
        <div>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-zinc-300">
            <Sparkles className="h-4 w-4 text-amber-500" />
            {t('vr_preview')}
          </p>
          <div className="print-area grid grid-cols-2 gap-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] p-4 sm:grid-cols-3 lg:grid-cols-4">
            {labels.map(({ key, client, code }) => (
              <div key={key} className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-gray-300 dark:border-white/15 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">{settings.storeName}</p>
                <p className="line-clamp-1 w-full text-xs font-semibold text-gray-900 dark:text-white">{client.name}</p>
                <Barcode128 value={code} height={34} width={1.4} fontSize={12} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default function VenteRapidePage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
