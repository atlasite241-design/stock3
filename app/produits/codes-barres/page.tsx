'use client'

import { useEffect, useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Barcode, ChevronLeft, ChevronRight, Printer, Save, Search, Sparkles, Tag, Wand2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Select from '@/components/Select'
import EAN13, { generateEan13, normalizeEan13 } from '@/components/EAN13'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

// Formats d'étiquettes courants (mm) pour imprimantes Zebra.
const LABEL_PRESETS = ['40 × 30', '50 × 30', '58 × 40', '38 × 25', '30 × 20', '60 × 40', '100 × 50']

function Content() {
  const { ready, products, settings, updateProduct, saveSettings } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [qty, setQty] = useState<Record<string, number>>({})
  const [testResult, setTestResult] = useState<string | null>(null)
  const [labelW, setLabelW] = useState(40)
  const [labelH, setLabelH] = useState(30)
  const [bcQuery, setBcQuery] = useState('')
  const [bcPage, setBcPage] = useState(1)

  useEffect(() => { setBcPage(1) }, [bcQuery])

  useEffect(() => {
    if (ready) {
      setLabelW(settings.labelWidthMm ?? 40)
      setLabelH(settings.labelHeightMm ?? 30)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const bcFiltered = useMemo(() => {
    const q = bcQuery.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.barcode.includes(q))
  }, [products, bcQuery])

  if (!ready) {
    return <Loader />
  }

  const BC_PAGE = 50
  const bcPageCount = Math.max(1, Math.ceil(bcFiltered.length / BC_PAGE))
  const bcSafePage = Math.min(bcPage, bcPageCount)
  const bcPageItems = bcFiltered.slice((bcSafePage - 1) * BC_PAGE, bcSafePage * BC_PAGE)

  const saveLabelSize = () => {
    saveSettings({ ...settings, labelWidthMm: Math.max(10, labelW), labelHeightMm: Math.max(10, labelH) })
    toast(`✓ ${t('barcodes_size_saved')}`)
  }

  // Impression Zebra : rendu des étiquettes dans un iframe isolé (document autonome),
  // puis impression de cet iframe. Contourne totalement la mise en page de l'app.
  const printLabels = async () => {
    const w = Math.max(10, labelW)
    const h = Math.max(10, labelH)
    const bcH = Math.min(60, Math.round(h * 1.5))
    const { renderToStaticMarkup } = await import('react-dom/server')
    const body = renderToStaticMarkup(
      <>
        {labels.map(({ key, product }) => (
          <div key={key} className="zlabel">
            <div style={{ fontSize: '6pt', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1 }}>{settings.storeName}</div>
            <div className="zname" style={{ fontSize: '7pt', fontWeight: 600, lineHeight: 1.05 }}>{product.name}</div>
            <EAN13 code={product.barcode} height={bcH} moduleWidth={1.1} />
            <div style={{ fontSize: '10pt', fontWeight: 800, lineHeight: 1 }}>{fmtDH(product.price)}</div>
          </div>
        ))}
      </>
    )
    const doc = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: ${w}mm ${h}mm; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
      .zlabel { width: ${w}mm; height: ${h}mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5mm; padding: 1mm; text-align: center; overflow: hidden; page-break-after: always; }
      .zlabel:last-child { page-break-after: auto; }
      .zname { max-height: 5mm; overflow: hidden; }
      svg { max-width: 100%; height: auto; }
    </style></head><body>${body}</body></html>`

    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
    document.body.appendChild(iframe)
    const idoc = iframe.contentWindow?.document
    if (!idoc) { iframe.remove(); return }
    idoc.open()
    idoc.write(doc)
    idoc.close()
    // Laisse le temps au rendu (SVG) puis imprime, et nettoie après.
    setTimeout(() => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      setTimeout(() => iframe.remove(), 2000)
    }, 350)
  }

  const setAll = (n: number) => {
    const next: Record<string, number> = {}
    products.forEach((p) => {
      if (normalizeEan13(p.barcode)) next[p.id] = n
    })
    setQty(next)
  }

  const labels = products.flatMap((p) => {
    const n = qty[p.id] ?? 0
    if (n <= 0 || !normalizeEan13(p.barcode)) return []
    return Array.from({ length: n }, (_, i) => ({ key: `${p.id}-${i}`, product: p }))
  })

  const generate = (id: string, name: string) => {
    const code = generateEan13()
    updateProduct(id, { barcode: code })
    toast(`✓ ${t('barcodes_toast_generated')} ${name}`)
  }

  const testScan = (code: string) => {
    const p = products.find((x) => x.barcode === code.trim())
    setTestResult(p ? `✓ ${p.name} — ${fmtDH(p.price)}` : `✗ ${t('barcodes_toast_not_found')} ${code}`)
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('barcodes_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('barcodes_subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setAll(1)} className="btn-secondary !h-9 text-xs">
            {t('barcodes_all_to_1')}
          </button>
          <button onClick={() => setAll(0)} className="btn-secondary !h-9 text-xs">
            {t('barcodes_all_to_0')}
          </button>
          <button
            onClick={printLabels}
            disabled={labels.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            {t('barcodes_print_labels')} ({labels.length})
          </button>
        </div>
      </motion.div>

      {/* Scanner test */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="glass-card max-w-xl p-4"
      >
        <p className="field-label">{t('barcodes_scanner_test')}</p>
        <div className="relative">
          <Barcode className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
          <input
            type="text"
            placeholder={t('barcodes_scan_here')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                testScan(e.currentTarget.value)
                e.currentTarget.value = ''
              }
            }}
            className="input-field pl-10"
          />
        </div>
        {testResult && (
          <p
            className={`mt-2 text-sm font-semibold ${
              testResult.startsWith('✓') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
            }`}
          >
            {testResult}
          </p>
        )}
      </motion.div>

      {/* Format d'étiquette Zebra */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.4 }}
        className="glass-card max-w-xl p-5"
      >
        <div className="mb-4 flex items-center gap-2">
          <Tag className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('barcodes_label_size')}</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="field-label">{t('barcodes_preset')}</label>
            <Select
              value={`${labelW} × ${labelH}`}
              onChange={(v) => { const [w, h] = v.split('×').map((s) => Number(s.trim())); setLabelW(w); setLabelH(h) }}
              options={LABEL_PRESETS}
              className="w-auto min-w-[130px]"
            />
          </div>
          <div>
            <label className="field-label">{t('barcodes_label_width')}</label>
            <input type="number" min="10" value={labelW} onChange={(e) => setLabelW(Number(e.target.value) || 0)} className="input-field !h-9 w-24" />
          </div>
          <div>
            <label className="field-label">{t('barcodes_label_height')}</label>
            <input type="number" min="10" value={labelH} onChange={(e) => setLabelH(Number(e.target.value) || 0)} className="input-field !h-9 w-24" />
          </div>
          <button onClick={saveLabelSize} className="btn-secondary !h-9 text-xs">
            <Save className="h-3.5 w-3.5" />
            {t('barcodes_save_size')}
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-400 dark:text-zinc-500">{t('barcodes_zebra_hint')}</p>
      </motion.div>

      {/* Products table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="border-b border-gray-100 p-4 dark:border-white/10">
          <div className="relative max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={bcQuery} onChange={(e) => setBcQuery(e.target.value)} placeholder={t('prod_search_placeholder')} className="input-field pl-10" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('barcodes_col_product')}</th>
                <th className="px-5 py-3.5">{t('barcodes_col_barcode')}</th>
                <th className="px-5 py-3.5">{t('barcodes_col_labels_to_print')}</th>
                <th className="px-5 py-3.5 text-right">{t('barcodes_col_action')}</th>
              </tr>
            </thead>
            <tbody>
              {bcPageItems.map((p) => {
                const valid = !!normalizeEan13(p.barcode)
                return (
                  <tr key={p.id} className="border-b border-gray-50 transition-colors hover:bg-amber-50/40">
                    <td className="px-5 py-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500">{fmtDH(p.price)}</p>
                    </td>
                    <td className="px-5 py-3">
                      {valid ? (
                        <EAN13 code={p.barcode} height={26} moduleWidth={1.4} />
                      ) : (
                        <span className="rounded-md bg-rose-50 dark:bg-rose-500/10 px-2 py-1 font-mono text-xs font-semibold text-rose-500 dark:text-rose-400">
                          {p.barcode || t('barcodes_no_valid_code')}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={qty[p.id] ?? 0}
                        onChange={(e) =>
                          setQty({ ...qty, [p.id]: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })
                        }
                        disabled={!valid}
                        className="input-field !h-9 w-24 disabled:opacity-40"
                      />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => generate(p.id, p.name)} className="btn-secondary !h-8 !px-3 text-xs">
                        <Wand2 className="h-3.5 w-3.5" />
                        {valid ? t('barcodes_regenerate') : t('barcodes_generate')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {bcPageCount > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-white/10">
            <p className="text-xs text-gray-500 dark:text-zinc-400 tabular-nums">{bcFiltered.length} · {bcSafePage}/{bcPageCount}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setBcPage(1)} disabled={bcSafePage === 1} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-500 disabled:opacity-40 dark:border-white/10">«</button>
              <button onClick={() => setBcPage((p) => Math.max(1, p - 1))} disabled={bcSafePage === 1} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 dark:border-white/10"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setBcPage((p) => Math.min(bcPageCount, p + 1))} disabled={bcSafePage === bcPageCount} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 dark:border-white/10"><ChevronRight className="h-4 w-4" /></button>
              <button onClick={() => setBcPage(bcPageCount)} disabled={bcSafePage === bcPageCount} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-500 disabled:opacity-40 dark:border-white/10">»</button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Labels preview / print area */}
      {labels.length > 0 && (
        <div>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-zinc-300">
            <Sparkles className="h-4 w-4 text-amber-500" />
            {t('barcodes_labels_preview')}
          </p>
          <div className="print-area grid grid-cols-2 gap-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] p-4 sm:grid-cols-3 lg:grid-cols-4">
            {labels.map(({ key, product }) => (
              <div
                key={key}
                className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-gray-300 dark:border-white/15 p-3 text-center"
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                  {settings.storeName}
                </p>
                <p className="line-clamp-1 w-full text-xs font-semibold text-gray-900 dark:text-white">{product.name}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(product.price)}</p>
                <EAN13 code={product.barcode} height={34} moduleWidth={1.4} />
              </div>
            ))}
          </div>
        </div>
      )}

    </>
  )
}

export default function CodesBarresPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
