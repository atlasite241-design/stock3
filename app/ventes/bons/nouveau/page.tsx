'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Barcode, Check, Plus, Printer } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Select from '@/components/Select'
import Barcode128 from '@/components/Barcode128'
import { useToast } from '@/components/Toast'
import { usePermissions } from '@/lib/access'
import { printBonLabel, printBonLabelZpl } from '@/lib/bonLabel'
import { useDroguerie, type BonPapier } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, clients, settings, addBon, printBon } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()
  const [clientId, setClientId] = useState('')
  const [created, setCreated] = useState<BonPapier | null>(null)

  const options = useMemo(
    () => clients.map((c) => ({ value: c.id, label: c.code ? `${c.name} — ${c.code}` : c.name })),
    [clients]
  )

  const printFor = async (b: BonPapier) => {
    const clientPhone = clients.find((c) => c.id === b.clientId)?.phone
    const show = { date: settings.bonLabelDate, vendeur: settings.bonLabelVendeur, phone: settings.bonLabelPhone }
    // Impression directe ZPL (Zebra) si activee ; sinon (ou en cas d'echec) navigateur.
    if (settings.bonLabelZpl && settings.zebraPrinterName) {
      const r = await printBonLabelZpl(
        { ref: b.ref, clientName: b.clientName, clientCode: b.clientCode, vendeurName: b.vendeurName, date: b.date, clientPhone },
        settings.zebraPrinterName,
        { widthMm: settings.labelWidthMm, heightMm: settings.labelHeightMm, storeName: settings.storeName, show, labels: { clientNo: t('bon_label_client_no') } }
      )
      if (r.ok) { toast(t('bon_zpl_sent')); return }
      toast(`${t('bon_zpl_failed')} ${r.message ?? ''}`.trim(), 'error')
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

  const generate = () => {
    if (!clientId) { toast(t('bon_new_client_required'), 'error'); return }
    const r = addBon(clientId)
    if ('error' in r) { toast(t('bon_new_client_required'), 'error'); return }
    setCreated(r)
    // Flux réel : on imprime et on colle l'étiquette immédiatement.
    if (can('bons.print')) {
      printBon(r.id)
      printFor(r)
    }
  }

  const reprint = () => {
    if (!created) return
    printBon(created.id)
    printFor(created)
  }

  if (!ready) return <Loader />

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <Barcode className="h-6 w-6 text-amber-500" />{t('bon_new_title')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('bon_new_sub')}</p>
      </motion.div>

      {!created ? (
        <div className="glass-card max-w-xl space-y-4 p-5">
          <div>
            <label className="field-label">{t('bon_new_pick_client')}</label>
            <Select value={clientId} onChange={setClientId} options={options} placeholder={t('bon_new_pick_client')} />
          </div>
          <button onClick={generate} disabled={!can('bons.create') || !clientId} className="btn-primary w-full disabled:opacity-40">
            <Barcode className="h-4 w-4" />{t('bon_new_generate')}
          </button>
        </div>
      ) : (
        <div className="glass-card max-w-xl space-y-4 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" />{t('bon_new_created')}
          </div>

          {/* Aperçu de l'étiquette telle qu'elle sera collée sur le bon papier. */}
          <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-white/10 dark:bg-white/5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{t('bon_label_client')}</div>
            <div className="text-base font-bold text-gray-900 dark:text-white">{created.clientName}</div>
            <div className="text-xs text-gray-500 dark:text-zinc-400">
              {t('bon_label_client_no')} : <span className="font-mono font-semibold">{created.clientCode}</span>
            </div>
            <div className="pt-1 font-mono text-lg font-bold text-gray-900 dark:text-white">
              {t('bon_label_bon_no')} {created.ref}
            </div>
            <div className="flex justify-center pt-1"><Barcode128 value={created.ref} /></div>
          </div>

          <div className="flex flex-wrap gap-2">
            {can('bons.print') && (
              <button onClick={reprint} className="btn-secondary flex-1">
                <Printer className="h-4 w-4" />{t('bon_reprint_label')}
              </button>
            )}
            <button onClick={() => { setCreated(null); setClientId('') }} className="btn-primary flex-1">
              <Plus className="h-4 w-4" />{t('bon_new_another')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
