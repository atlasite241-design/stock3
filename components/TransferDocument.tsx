'use client'

import { transferQty, useDroguerie, type Transfer } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function TransferDocument({ transfer }: { transfer: Transfer }) {
  const { settings, stores, depots } = useDroguerie()
  const { t } = useLanguage()

  const storeLabel = (storeId: string, depotId?: string) => {
    const s = stores.find((x) => x.id === storeId)
    const d = depotId ? depots.find((x) => x.id === depotId) : null
    return [s?.name, d?.name].filter(Boolean).join(' · ') || '—'
  }

  const dateStr = new Date(transfer.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const totalQty = transferQty(transfer.items, transfer.status === 'termine' ? 'receivedQty' : transfer.status === 'expedie' ? 'transferredQty' : 'requestedQty')
  const qtyKey: 'requestedQty' | 'transferredQty' | 'receivedQty' =
    transfer.status === 'termine' ? 'receivedQty' : transfer.status === 'expedie' ? 'transferredQty' : 'requestedQty'
  const emptyRows = Math.max(0, 6 - transfer.items.length)

  return (
    <div className="print-area invoice-print bg-white p-6 text-[13px] text-gray-900" style={{ colorScheme: 'light' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          {settings.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoDataUrl} alt="logo" className="h-14 w-14 rounded object-contain" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded bg-gray-900 text-lg font-black italic text-white">
              {(settings.storeName || 'DP').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-bold uppercase text-gray-900">{settings.storeName}</p>
            {settings.slogan && <p className="max-w-[180px] text-[11px] italic leading-snug text-gray-400">{settings.slogan}</p>}
          </div>
        </div>
        <div className="text-right text-[11px] italic text-gray-500">
          <p>{dateStr}</p>
          <p>{t('trf_page')}</p>
        </div>
      </div>

      {/* Title */}
      <div className="mt-6">
        <h2 className="text-3xl font-black leading-none tracking-tight text-gray-900">
          {t('trf_doc_title')}
          <span className="align-baseline text-xl font-bold text-gray-500"> {transfer.ref}</span>
        </h2>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-amber-600">{t('trf_internal_note')}</p>
      </div>

      {/* Source / destination */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-md border border-gray-200 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{t('trf_source')}</p>
          <p className="text-sm font-bold text-gray-900">{storeLabel(transfer.sourceStoreId, transfer.sourceDepotId)}</p>
        </div>
        <div className="rounded-md border border-gray-200 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{t('trf_dest')}</p>
          <p className="text-sm font-bold text-gray-900">{storeLabel(transfer.destStoreId, transfer.destDepotId)}</p>
        </div>
      </div>

      {/* Products */}
      <table className="mt-4 w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-amber-400 text-left text-white">
            <th className="border border-amber-500 px-2 py-1.5 font-bold italic">{t('trf_col_barcode')}</th>
            <th className="border border-amber-500 px-2 py-1.5 font-bold italic">{t('trf_col_name')}</th>
            <th className="border border-amber-500 px-2 py-1.5 text-center font-bold italic">{t('trf_total_qty')}</th>
          </tr>
        </thead>
        <tbody>
          {transfer.items.map((it, idx) => (
            <tr key={idx}>
              <td className="border border-gray-200 px-2 py-1.5 font-mono text-[11px]">{it.barcode || '—'}</td>
              <td className="border border-gray-200 px-2 py-1.5">{it.name}</td>
              <td className="border border-gray-200 px-2 py-1.5 text-center font-semibold tabular-nums">{Number(it[qtyKey]) || 0}</td>
            </tr>
          ))}
          {Array.from({ length: emptyRows }).map((_, idx) => (
            <tr key={`e${idx}`}>
              <td className="border border-gray-200 px-2 py-1.5">&nbsp;</td>
              <td className="border border-gray-200 px-2 py-1.5" />
              <td className="border border-gray-200 px-2 py-1.5" />
            </tr>
          ))}
          <tr>
            <td className="border border-gray-200 px-2 py-1.5 text-right font-bold" colSpan={2}>{t('trf_total_qty')}</td>
            <td className="border border-gray-200 px-2 py-1.5 text-center font-black tabular-nums">{totalQty}</td>
          </tr>
        </tbody>
      </table>

      {transfer.note && <p className="mt-3 text-[11px] text-gray-600"><span className="font-semibold">{t('trf_note')} :</span> {transfer.note}</p>}

      {/* Signatures */}
      <div className="invoice-signature mt-10 flex justify-between gap-8">
        <div className="flex-1 text-center">
          <p className="text-[11px] text-gray-500">{t('trf_doc_sender')}</p>
          <div className="mx-auto mt-12 w-48 border-t border-gray-300" />
        </div>
        <div className="flex-1 text-center">
          <p className="text-[11px] text-gray-500">{t('trf_doc_receiver')}</p>
          <div className="mx-auto mt-12 w-48 border-t border-gray-300" />
        </div>
      </div>
    </div>
  )
}
