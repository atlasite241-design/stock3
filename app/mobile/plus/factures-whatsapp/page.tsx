'use client'

import { useMemo } from 'react'
import { MessageCircle } from 'lucide-react'
import MobileSubShell from '@/components/MobileSubShell'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

// Normalise un numéro marocain vers le format international pour wa.me.
function waNumber(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('212')) return digits
  if (digits.startsWith('0')) return '212' + digits.slice(1)
  return digits
}

export default function MobileFacturesWhatsappPage() {
  const { credits, clients, settings } = useDroguerie()
  const { t } = useLanguage()

  const rows = useMemo(() => {
    return credits
      .filter((c) => c.amount - c.paid > 0.001)
      .map((c) => {
        const client = clients.find((x) => x.id === c.clientId)
        return { c, phone: client?.phone ?? '', remaining: c.amount - c.paid }
      })
      .sort((a, b) => a.c.dueDate.localeCompare(b.c.dueDate))
  }, [credits, clients])

  const send = (row: (typeof rows)[number]) => {
    const num = waNumber(row.phone)
    const company = settings?.storeName || 'Droguerie'
    const ref = row.c.invoiceRef || row.c.ref
    const msg =
      `Bonjour ${row.c.clientName},\n` +
      `Votre facture ${ref} d'un montant de ${fmtDH(row.c.amount)}.\n` +
      `Reste à régler : ${fmtDH(row.remaining)}.\n` +
      `Merci — ${company}`
    const url = num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  return (
    <MobileSubShell title={t('mob_wa_title')} subtitle={t('mob_wa_subtitle')}>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-6 text-center text-sm text-emerald-400">{t('mob_wa_none')}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.c.id} className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.08] p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{row.c.clientName}</p>
                  <p className="text-xs text-slate-400">{row.c.invoiceRef || row.c.ref}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-amber-400 tabular-nums">{fmtDH(row.remaining)}</p>
              </div>
              {!row.phone && <p className="mt-2 text-xs text-rose-400">{t('mob_wa_no_phone')}</p>}
              <button
                onClick={() => send(row)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" />{t('mob_wa_send')}
              </button>
            </div>
          ))}
        </div>
      )}
    </MobileSubShell>
  )
}
