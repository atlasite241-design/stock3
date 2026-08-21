'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Pencil, Printer, ScanLine, Search, XCircle } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Modal from '@/components/Modal'
import BonsTable from '@/components/BonsTable'
import { useToast } from '@/components/Toast'
import { usePermissions } from '@/lib/access'
import { printBonLabel, printBonLabelZpl } from '@/lib/bonLabel'
import { BON_A_SAISIR, useDroguerie, type BonPapier } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, bons, clients, settings, printBon, cancelBon } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [toCancel, setToCancel] = useState<BonPapier | null>(null)
  const [motif, setMotif] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bons
      .filter((b) => BON_A_SAISIR.includes(b.status))
      .filter((b) => !q || b.ref.toLowerCase().includes(q) || b.clientName.toLowerCase().includes(q) || (b.clientCode ?? '').toLowerCase().includes(q))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [bons, query])

  const printLabelFor = async (b: BonPapier) => {
    printBon(b.id)
    const clientPhone = clients.find((c) => c.id === b.clientId)?.phone
    const show = { date: settings.bonLabelDate, vendeur: settings.bonLabelVendeur, phone: settings.bonLabelPhone }
    if (settings.bonLabelZpl) {
      const r = await printBonLabelZpl(
        { ref: b.ref, clientName: b.clientName, clientCode: b.clientCode, vendeurName: b.vendeurName, date: b.date, clientPhone },
        settings.zebraPrinterName || 'Zebra GK420d - ZPL',
        { widthMm: settings.labelWidthMm, heightMm: settings.labelHeightMm, storeName: settings.storeName, show, labels: { clientNo: t('bon_label_client_no') } }
      )
      if (r.ok) { toast(t('bon_zpl_sent')); return }
      toast(`${t('bon_zpl_failed')} ${r.message ?? ''}`.trim(), 'error')
      // Pas de repli navigateur quand le ZPL est activé : éviter d'imprimer des pages vides.
      return
    }
    printBonLabel(b, {
      storeName: settings.storeName,
      widthMm: settings.labelWidthMm,
      heightMm: settings.labelHeightMm,
      labels: { client: t('bon_label_client'), clientNo: t('bon_label_client_no'), bonNo: t('bon_label_bon_no') },
      show,
      clientPhone,
    })
  }

  const doCancel = () => {
    if (!toCancel) return
    const r = cancelBon(toCancel.id, motif.trim() || undefined)
    if (r.ok) toast(t('bon_cancel_done'))
    setToCancel(null); setMotif('')
  }

  if (!ready) return <Loader />

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Pencil className="h-6 w-6 text-amber-500" />{t('bon_to_enter_title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('bon_to_enter_sub')}</p>
        </div>
        {can('bons.scan') && (
          <button onClick={() => router.push('/ventes/bons/scanner')} className="btn-primary h-12 px-5 text-base font-bold">
            <ScanLine className="h-5 w-5" />{t('bon_scan_bon_btn')}
          </button>
        )}
      </motion.div>

      <div className="glass-card flex items-center gap-2 p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('bon_filter_search')} className="input-field h-11 pl-10" />
        </div>
        <span className="shrink-0 px-2 text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">{rows.length}</span>
      </div>

      <BonsTable
        bons={rows}
        renderActions={(b) => (
          <div className="flex items-center justify-end gap-1">
            {can('bons.enter') && (
              <button onClick={() => router.push(`/ventes/bons/saisie?id=${b.id}`)} title={t('bon_enter_action')} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-600">
                {t('bon_enter_action')}
              </button>
            )}
            {can('bons.print') && (
              <button onClick={() => printLabelFor(b)} title={t('bon_label_short')} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10">
                <Printer className="h-4 w-4" />
              </button>
            )}
            {can('bons.cancel') && (
              <button onClick={() => setToCancel(b)} title={t('bon_cancel_action')} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      />

      <Modal open={!!toCancel} onClose={() => { setToCancel(null); setMotif('') }} title={`${t('bon_cancel_title')} — ${toCancel?.ref ?? ''}`}>
        <div className="space-y-4">
          <div>
            <label className="field-label">{t('bon_cancel_reason')}</label>
            <input value={motif} onChange={(e) => setMotif(e.target.value)} className="input-field" />
          </div>
          <button onClick={doCancel} className="btn-primary w-full bg-rose-500 hover:bg-rose-600">
            <XCircle className="h-4 w-4" />{t('bon_cancel_confirm')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
