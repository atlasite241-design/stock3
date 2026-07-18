'use client'

import { fmtDH, useDroguerie, type Settings } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export interface DocLine {
  label: string
  qty: number
  unit?: string
  puHT: number
  tvaPct: number
}

// --- Montant en toutes lettres (français, dirhams + centimes) ---
const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const T = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', '', 'quatre-vingt', '']

function below100(n: number): string {
  if (n < 20) return U[n]
  const t = Math.floor(n / 10)
  const u = n % 10
  if (t === 7) return u === 1 ? 'soixante et onze' : 'soixante-' + U[10 + u]
  if (t === 9) return 'quatre-vingt-' + U[10 + u]
  let w = T[t]
  if (t === 8 && u === 0) w = 'quatre-vingts'
  if (u === 0) return w
  if (u === 1 && t >= 2 && t <= 6) return w + ' et un'
  return w + '-' + U[u]
}

function below1000(n: number): string {
  if (n === 0) return ''
  const h = Math.floor(n / 100)
  const r = n % 100
  let s = ''
  if (h > 0) {
    s = h === 1 ? 'cent' : U[h] + ' cent'
    if (r === 0 && h > 1) s += 's'
  }
  if (r > 0) s = (s ? s + ' ' : '') + below100(r)
  return s
}

function frenchWords(n: number): string {
  if (n === 0) return 'zéro'
  const mil = Math.floor(n / 1_000_000)
  const th = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  const parts: string[] = []
  if (mil > 0) parts.push(mil === 1 ? 'un million' : below1000(mil) + ' millions')
  if (th > 0) parts.push(th === 1 ? 'mille' : below1000(th) + ' mille')
  if (rest > 0) parts.push(below1000(rest))
  return parts.join(' ')
}

export function montantEnLettres(amount: number): string {
  const safe = Math.max(0, amount || 0)
  const dh = Math.floor(safe + 1e-9)
  const cents = Math.round((safe - dh) * 100)
  let s = `${frenchWords(dh)} ${dh <= 1 ? 'dirham' : 'dirhams'}`
  if (cents > 0) s += ` et ${frenchWords(cents)} ${cents <= 1 ? 'centime' : 'centimes'}`
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function InvoiceDocument({
  title,
  number,
  docNumber,
  date,
  partyLabel,
  partyName,
  partyAddress,
  lines,
  paid,
  showBalance = false,
  settingsOverride,
}: {
  title: string
  number?: string
  docNumber?: string
  date: string
  partyLabel: string
  partyName: string
  partyAddress?: string
  lines: DocLine[]
  paid?: number
  showBalance?: boolean
  settingsOverride?: Settings
}) {
  const { settings: storeSettings, activeStore } = useDroguerie()
  // Documents carry the active store's coordinates (name, address, contact, ICE, IF, logo),
  // falling back to the global company settings. An explicit override (e.g. live preview) wins.
  const settings: Settings = settingsOverride
    ? settingsOverride
    : activeStore
      ? {
          ...storeSettings,
          storeName: activeStore.name || storeSettings.storeName,
          address: activeStore.address || storeSettings.address,
          phone: activeStore.phone || storeSettings.phone,
          email: activeStore.email || storeSettings.email,
          logoDataUrl: activeStore.logoDataUrl || storeSettings.logoDataUrl,
          ice: activeStore.ice || storeSettings.ice,
          idFiscal: activeStore.idFiscal || storeSettings.idFiscal,
        }
      : storeSettings
  const { t } = useLanguage()

  const totalHT = lines.reduce((a, l) => a + l.puHT * l.qty, 0)
  const totalTVA = lines.reduce((a, l) => a + l.puHT * l.qty * (l.tvaPct / 100), 0)
  const totalTTC = totalHT + totalTVA

  const city = (settings.address || '').split(',')[0].trim()
  const dateStr = new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  // Keep a few filler rows so the bordered table looks complete, without overflowing A4
  const emptyRows = Math.max(0, 6 - lines.length)

  const legalBits = [
    settings.phone && `TÉL : ${settings.phone}`,
    settings.email && `EMAIL : ${settings.email}`,
    settings.taxePro && `PATENTE : ${settings.taxePro}`,
    settings.rcNo && `RC : ${settings.rcNo}`,
    settings.idFiscal && `IF : ${settings.idFiscal}`,
    settings.ice && `ICE : ${settings.ice}`,
    settings.cnss && `CNSS : ${settings.cnss}`,
  ].filter(Boolean)

  return (
    <div className="print-area invoice-print bg-white p-6 text-[13px] text-gray-900" style={{ colorScheme: 'light' }}>
      {/* Header: company box top-right */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          {settings.logoDataUrl ? (
            <img src={settings.logoDataUrl} alt="logo" className="h-14 w-14 rounded object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded bg-gray-900 text-lg font-black italic text-white">
              {(settings.storeName || 'DP').slice(0, 2).toUpperCase()}
            </div>
          )}
          {settings.slogan && <p className="max-w-[160px] text-[11px] italic leading-snug text-gray-400">{settings.slogan}</p>}
        </div>
        <div className="rounded-md border-2 border-amber-400 px-4 py-3 text-right">
          <p className="text-sm font-bold uppercase text-gray-900">{settings.storeName}</p>
          {partyAddress === undefined && <p className="text-[11px] text-gray-600">{settings.address}</p>}
          {settings.email && <p className="text-[11px] text-gray-600">{settings.email}</p>}
          <p className="text-[11px] text-gray-600">{settings.phone}</p>
        </div>
      </div>

      {/* Title row */}
      <div className="mt-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-3xl font-black leading-none tracking-tight text-gray-900">
            {title}
            {docNumber && <span className="align-baseline text-xl font-bold text-gray-500"> {docNumber}</span>}
          </h2>
          {number && (
            <p className="mt-1 text-sm font-semibold text-gray-500">
              {t('fdoc_number')} <span className="text-gray-800">{number}</span>
            </p>
          )}
        </div>
        <div className="shrink-0 whitespace-nowrap text-right text-[11px] italic text-gray-500">
          <p>
            {city ? `${city} ` : ''}
            {t('fdoc_at_le')} {dateStr}
          </p>
          <p>{t('fdoc_page')}</p>
        </div>
      </div>

      {/* Party block */}
      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{partyLabel}</p>
        <p className="text-sm font-bold text-gray-900">{partyName}</p>
        {partyAddress && <p className="text-[11px] text-gray-600">{partyAddress}</p>}
      </div>

      {/* Table */}
      <table className="mt-4 w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-amber-400 text-left text-white">
            <th className="border border-amber-500 px-2 py-1.5 font-bold italic">{t('fdoc_col_products')}</th>
            <th className="border border-amber-500 px-2 py-1.5 text-center font-bold italic">{t('fdoc_col_qty')}</th>
            <th className="border border-amber-500 px-2 py-1.5 text-center font-bold italic">{t('fdoc_col_unit')}</th>
            <th className="border border-amber-500 px-2 py-1.5 text-right font-bold italic">{t('fdoc_col_pu_ht')}</th>
            <th className="border border-amber-500 px-2 py-1.5 text-center font-bold italic">{t('fdoc_col_tva')}</th>
            <th className="border border-amber-500 px-2 py-1.5 text-right font-bold italic">{t('fdoc_col_total_ht')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, idx) => (
            <tr key={idx}>
              <td className="border border-gray-200 px-2 py-1.5">{l.label}</td>
              <td className="border border-gray-200 px-2 py-1.5 text-center tabular-nums">{l.qty}</td>
              <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-500">{l.unit || '-'}</td>
              <td className="border border-gray-200 px-2 py-1.5 text-right tabular-nums">{fmtDH(l.puHT)}</td>
              <td className="border border-gray-200 px-2 py-1.5 text-center tabular-nums">{l.tvaPct.toFixed(2)} %</td>
              <td className="border border-gray-200 px-2 py-1.5 text-right font-semibold tabular-nums">{fmtDH(l.puHT * l.qty)}</td>
            </tr>
          ))}
          {Array.from({ length: emptyRows }).map((_, idx) => (
            <tr key={`e${idx}`}>
              <td className="border border-gray-200 px-2 py-1.5">&nbsp;</td>
              <td className="border border-gray-200 px-2 py-1.5" />
              <td className="border border-gray-200 px-2 py-1.5" />
              <td className="border border-gray-200 px-2 py-1.5" />
              <td className="border border-gray-200 px-2 py-1.5" />
              <td className="border border-gray-200 px-2 py-1.5" />
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-4 flex items-start justify-between gap-6">
        <div className="max-w-[50%] pt-1 text-[12px] leading-snug text-gray-700">
          <p className="font-semibold">{t('fdoc_amount_words')}</p>
          <p className="mt-1 font-bold text-gray-900">{montantEnLettres(totalTTC)}.</p>
        </div>
        <div className="w-64 space-y-1 text-[12px]">
          <div className="flex justify-between text-gray-600">
            <span className="font-semibold">{t('fdoc_total_ht')}</span>
            <span className="tabular-nums">{fmtDH(totalHT)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span className="font-semibold">{t('fdoc_total_tva')}</span>
            <span className="tabular-nums">{fmtDH(totalTVA)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-300 pt-1 text-base font-black text-gray-900">
            <span>{t('fdoc_total_ttc')}</span>
            <span className="tabular-nums">{fmtDH(totalTTC)}</span>
          </div>
          {paid !== undefined && (
            <div className="flex justify-between pt-0.5 text-gray-600">
              <span className="font-semibold">{t('fdoc_paid')}</span>
              <span className="tabular-nums">{fmtDH(paid)}</span>
            </div>
          )}
          {showBalance && paid !== undefined && (
            <div className="flex justify-between text-sm font-bold text-gray-900">
              <span>{t('fdoc_remaining')}</span>
              <span className="tabular-nums">{fmtDH(Math.max(0, totalTTC - paid))}</span>
            </div>
          )}
        </div>
      </div>

      {/* Signature */}
      <div className="invoice-signature mt-5 flex justify-end">
        <div className="text-center">
          <p className="text-[11px] text-gray-500">{t('fdoc_signature')}</p>
          {settings.signatureDataUrl ? (
            <img src={settings.signatureDataUrl} alt="signature" className="mx-auto mt-1 h-16 w-40 object-contain" />
          ) : (
            <div className="mt-10 w-40 border-t border-gray-300" />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="invoice-footer mt-6 border-t border-gray-200 pt-3 text-center">
        {settings.invoiceTerms && (
          <p className="mb-2 whitespace-pre-line text-left text-[8.5px] leading-relaxed text-gray-500">{settings.invoiceTerms}</p>
        )}
        {legalBits.length > 0 && (
          <p className="text-[9px] leading-relaxed text-gray-500">{legalBits.join('  |  ')}</p>
        )}
        <p className="mt-1 text-[11px] font-semibold italic text-gray-600">{t('fdoc_thanks')}</p>
      </div>
    </div>
  )
}
