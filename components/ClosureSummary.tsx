'use client'

import { computeSessionSummary, fmtDH, sessionExpected, useDroguerie, type RegisterSession } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type Kind = 'base' | 'in' | 'out' | 'info'

export default function ClosureSummary({ session }: { session: RegisterSession }) {
  const { sales, cash, clientPayments } = useDroguerie()
  const { t } = useLanguage()

  const s = session.summary ?? computeSessionSummary(session, sales, cash, clientPayments)
  const expected = sessionExpected(session, s)
  const counted = session.closingAmount ?? 0
  const gap = counted - expected

  const rows: { label: string; value: number; kind: Kind }[] = [
    { label: t('clot_float'), value: session.openingAmount, kind: 'base' },
    { label: t('clot_cash_sales'), value: s.salesEspeces, kind: 'in' },
    { label: t('clot_card'), value: s.salesCarte, kind: 'info' },
    { label: t('clot_transfer'), value: s.salesVirement, kind: 'info' },
    { label: t('clot_credit'), value: s.salesCredit, kind: 'info' },
    ...(s.otherCashIn > 0 ? [{ label: t('clot_other_in'), value: s.otherCashIn, kind: 'in' as Kind }] : []),
    { label: t('clot_expenses'), value: s.depenses, kind: 'out' },
    { label: t('clot_withdrawals'), value: s.retraits, kind: 'out' },
  ]

  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-gray-50 dark:border-white/5">
            <td className="px-5 py-2.5">
              <span className="text-gray-700 dark:text-zinc-300">{r.label}</span>
              {r.kind === 'info' && (
                <span className="ml-2 rounded bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-gray-400 dark:text-zinc-500">
                  {t('clot_out_of_drawer')}
                </span>
              )}
            </td>
            <td
              className={`px-5 py-2.5 text-right font-semibold tabular-nums ${
                r.kind === 'in'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : r.kind === 'out'
                    ? 'text-rose-500 dark:text-rose-400'
                    : r.kind === 'info'
                      ? 'text-gray-400 dark:text-zinc-500'
                      : 'text-gray-900 dark:text-white'
              }`}
            >
              {r.kind === 'in' ? '+' : r.kind === 'out' ? '−' : ''}
              {fmtDH(r.value)}
            </td>
          </tr>
        ))}
        <tr className="bg-amber-50 dark:bg-amber-500/10">
          <td className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white">{t('clot_theoretical')}</td>
          <td className="px-5 py-3 text-right text-base font-black text-gray-900 dark:text-white tabular-nums">{fmtDH(expected)}</td>
        </tr>
        <tr className="border-t border-gray-100 dark:border-white/10">
          <td className="px-5 py-2.5 text-gray-700 dark:text-zinc-300">{t('fdj_counted')}</td>
          <td className="px-5 py-2.5 text-right font-semibold text-gray-900 dark:text-white tabular-nums">{fmtDH(counted)}</td>
        </tr>
        <tr>
          <td className="px-5 py-2.5 font-bold text-gray-900 dark:text-white">{t('fdj_gap')}</td>
          <td className={`px-5 py-2.5 text-right font-bold tabular-nums ${gap === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {gap > 0 ? '+' : ''}
            {fmtDH(gap)}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
