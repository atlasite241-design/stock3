'use client'

// Bulletins de paie.
//
// Un bulletin émis est FIGÉ : il enregistre le barème appliqué (`rates`) en même
// temps que les montants. Un changement de taux l'année suivante ne doit pas
// réécrire un bulletin déjà remis à l'employé.

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileSpreadsheet, Printer, Receipt, Trash2, Zap } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import Loader from '@/components/Loader'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import {
  RATES_2025, computePayslip, monthLabel, periodOf, todayISO,
  type Attendance, type PayAdjustment, type Payslip,
} from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const payslips = useHrList<Payslip>('payslips')
  const adjustments = useHrList<PayAdjustment>('adjustments')
  const attendance = useHrList<Attendance>('attendance')
  const { active: employees, byId } = useEmployees()
  const { settings, activeStore } = useDroguerie()
  const { t, lang } = useLanguage()
  const toast = useToast()

  const focused = useSearchParams().get('id')
  const [period, setPeriod] = useState(periodOf(todayISO()))
  const [open, setOpen] = useState<Payslip | null>(
    () => null
  )

  const forPeriod = useMemo(
    () => payslips.items.filter((p) => p.period === period).sort((a, b) => a.employeeId.localeCompare(b.employeeId)),
    [payslips.items, period]
  )

  const shown = focused ? payslips.items.find((p) => p.id === focused) ?? open : open

  /**
   * Génère les bulletins manquants du mois, en UNE seule écriture.
   * Les bulletins déjà émis ne sont jamais recalculés — c'est un document remis,
   * pas une vue.
   */
  const generate = () => {
    const done = new Set(forPeriod.map((p) => p.employeeId))
    const missing = employees.filter((e) => !done.has(e.id))
    if (!missing.length) {
      toast(t('hr_pay_all_done'))
      return
    }
    const created: Payslip[] = missing.map((e) => {
      const mine = adjustments.items.filter((a) => a.employeeId === e.id && a.period === period)
      const primes = mine.filter((a) => a.kind === 'prime').map((a) => ({ label: a.label, amount: a.amount, taxable: a.taxable !== false }))
      const avances = mine.filter((a) => a.kind === 'avance').reduce((s, a) => s + a.amount, 0)
      const deductions = mine.filter((a) => a.kind === 'deduction').map((a) => ({ label: a.label, amount: a.amount }))
      const att = attendance.items.filter((a) => a.employeeId === e.id && a.date.startsWith(period))
      const c = computePayslip({ base: e.baseSalary, primes, avances, deductions, dependents: e.dependents })
      return {
        id: `${e.id}_${period}`,
        employeeId: e.id,
        period,
        base: e.baseSalary,
        primes: c.primes,
        brutImposable: c.brutImposable,
        brut: c.brut,
        cnss: c.cnss,
        amo: c.amo,
        fraisPro: c.fraisPro,
        netImposable: c.netImposable,
        ir: c.ir,
        avances,
        deductions: c.deductions,
        net: c.net,
        daysWorked: att.filter((a) => a.status === 'present').length,
        daysAbsent: att.filter((a) => a.status === 'absent').length,
        issuedAt: new Date().toISOString(),
        rates: RATES_2025,
        storeId: e.storeId,
      }
    })
    payslips.replaceAll([...created, ...payslips.all])
    toast(`✓ ${created.length} ${t('hr_pay_generated')}`)
  }

  const exportXlsx = async () => {
    const XLSX = await import('xlsx')
    const aoa = [
      [t('hr_f_matricule'), t('hr_f_name'), t('hr_pay_brut'), 'CNSS', 'AMO', t('hr_pay_fp'), t('hr_pay_sni'), 'IR', t('hr_adv_title'), t('hr_ded_title'), t('hr_pay_net')],
      ...forPeriod.map((p) => {
        const e = byId(p.employeeId)
        return [
          e?.matricule ?? '', e?.name ?? '', p.brut, p.cnss, p.amo, p.fraisPro, p.netImposable, p.ir,
          p.avances, p.deductions.reduce((a, d) => a + d.amount, 0), p.net,
        ]
      }),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Paie')
    XLSX.writeFile(wb, `paie-${period}.xlsx`)
  }

  const totals = forPeriod.reduce(
    (a, p) => ({ brut: a.brut + p.brut, net: a.net + p.net, charges: a.charges + p.cnss + p.amo + p.ir }),
    { brut: 0, net: 0, charges: 0 }
  )

  return (
    <>
      <div className="glass-card flex flex-wrap items-end gap-3 p-4 no-print">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_adj_period')}</span>
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="input-field" />
        </label>
        <button onClick={generate} className="btn-primary"><Zap className="h-4 w-4" />{t('hr_pay_generate')}</button>
        <button onClick={exportXlsx} disabled={!forPeriod.length} className="btn-secondary disabled:opacity-40">
          <FileSpreadsheet className="h-4 w-4" />Excel
        </button>
      </div>

      <HrStats
        cards={[
          { label: t('hr_pay_count'), value: String(forPeriod.length) },
          { label: t('hr_pay_brut'), value: fmtDH(totals.brut) },
          { label: t('hr_sal_charges'), value: fmtDH(totals.charges), tone: 'text-orange-600 dark:text-orange-400' },
          { label: t('hr_pay_net'), value: fmtDH(totals.net), tone: 'text-emerald-600 dark:text-emerald-400' },
        ]}
      />

      {forPeriod.length === 0 ? (
        <p className="glass-card p-12 text-center text-sm text-gray-500 dark:text-zinc-400">{t('hr_pay_none')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {forPeriod.map((p) => {
            const e = byId(p.employeeId)
            return (
              <div key={p.id} className="glass-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{e?.name ?? '—'}</p>
                    <p className="font-mono text-[11px] text-gray-400">{e?.matricule}</p>
                  </div>
                  <button onClick={() => payslips.remove(p.id)} className="text-gray-300 transition-colors hover:text-rose-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-2xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtDH(p.net)}</p>
                <p className="text-[11px] text-gray-400">{t('hr_pay_brut')} {fmtDH(p.brut)}</p>
                <button onClick={() => setOpen(p)} className="btn-secondary mt-3 w-full justify-center">{t('hr_pay_open')}</button>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={!!shown} onClose={() => setOpen(null)} title={t('hr_pay_slip')} maxWidth="max-w-2xl">
        {shown && (() => {
          const e = byId(shown.employeeId)
          const r = shown.rates ?? RATES_2025
          const line = (label: string, value: number, strong = false, negative = false) => (
            <div className={`flex justify-between py-1 text-sm ${strong ? 'font-bold' : ''}`}>
              <span className={strong ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-zinc-300'}>{label}</span>
              <span className={`tabular-nums ${negative ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
                {negative ? '-' : ''}{fmtDH(value)}
              </span>
            </div>
          )
          return (
            <div id="payslip" className="space-y-4">
              <div className="flex items-start justify-between border-b border-gray-200 pb-3 dark:border-white/10">
                <div>
                  <p className="text-base font-extrabold text-gray-900 dark:text-white">{settings.storeName || activeStore?.name}</p>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400">{settings.address}</p>
                  {settings.cnss && <p className="text-[10px] text-gray-400">CNSS {settings.cnss}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">{t('hr_pay_slip')}</p>
                  <p className="text-xs capitalize text-gray-500 dark:text-zinc-400">{monthLabel(shown.period, lang)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <p><span className="text-gray-400">{t('hr_f_name')} : </span><b className="text-gray-900 dark:text-white">{e?.name}</b></p>
                <p><span className="text-gray-400">{t('hr_f_matricule')} : </span><b className="font-mono text-gray-900 dark:text-white">{e?.matricule}</b></p>
                <p><span className="text-gray-400">{t('hr_f_poste')} : </span><b className="text-gray-900 dark:text-white">{e?.poste}</b></p>
                <p><span className="text-gray-400">CNSS : </span><b className="font-mono text-gray-900 dark:text-white">{e?.cnss || '—'}</b></p>
                <p><span className="text-gray-400">{t('hr_f_hire')} : </span><b className="text-gray-900 dark:text-white">{e?.hireDate}</b></p>
                <p><span className="text-gray-400">{t('hr_f_dependents')} : </span><b className="text-gray-900 dark:text-white">{e?.dependents ?? 0}</b></p>
              </div>

              <div className="rounded-xl border border-gray-100 p-3 dark:border-white/10">
                {line(t('hr_f_salary'), shown.base)}
                {shown.primes.map((p, i) => (
                  <div key={i} className="flex justify-between py-1 text-sm">
                    <span className="text-gray-600 dark:text-zinc-300">
                      {p.label}
                      {p.taxable === false && <span className="ml-1 text-[10px] text-gray-400">({t('hr_adj_exempt')})</span>}
                    </span>
                    <span className="tabular-nums text-gray-900 dark:text-white">{fmtDH(p.amount)}</span>
                  </div>
                ))}
                <div className="mt-1 border-t border-gray-100 pt-1 dark:border-white/10">
                  {line(t('hr_pay_brut'), shown.brut, true)}
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 p-3 dark:border-white/10">
                {line(`CNSS ${(r.cnssRate * 100).toFixed(2)} % (${t('hr_pay_capped')} ${fmtDH(r.cnssCeiling)})`, shown.cnss, false, true)}
                {line(`AMO ${(r.amoRate * 100).toFixed(2)} %`, shown.amo, false, true)}
                <div className="flex justify-between py-1 text-xs text-gray-400">
                  <span>{t('hr_pay_fp')}</span>
                  <span className="tabular-nums">{fmtDH(shown.fraisPro)}</span>
                </div>
                <div className="flex justify-between py-1 text-xs text-gray-400">
                  <span>{t('hr_pay_sni')}</span>
                  <span className="tabular-nums">{fmtDH(shown.netImposable)}</span>
                </div>
                {line(`IR (${t('hr_pay_scale')} ${r.year})`, shown.ir, false, true)}
                {shown.avances > 0 && line(t('hr_adv_title'), shown.avances, false, true)}
                {shown.deductions.map((d, i) => (
                  <div key={i} className="flex justify-between py-1 text-sm">
                    <span className="text-gray-600 dark:text-zinc-300">{d.label}</span>
                    <span className="tabular-nums text-rose-600 dark:text-rose-400">-{fmtDH(d.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10">
                <span className="text-sm font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{t('hr_pay_net')}</span>
                <span className="text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">{fmtDH(shown.net)}</span>
              </div>

              <p className="text-[10px] leading-relaxed text-gray-400">
                {t('hr_pay_days')} : {shown.daysWorked ?? 0} · {t('hr_att_absent')} : {shown.daysAbsent ?? 0} — {t('hr_pay_footer')}
              </p>

              <div className="flex justify-end gap-2 no-print">
                <button onClick={() => window.print()} className="btn-primary"><Printer className="h-4 w-4" />{t('hr_pay_print')}</button>
              </div>
            </div>
          )
        })()}
      </Modal>

      <style>{`@media print {
        aside, header.app-header, .no-print { display: none !important }
        .modal-root { position: static !important }
        .modal-root > div:first-child { display: none !important }
        .modal-panel { max-height: none !important; box-shadow: none !important; border: 0 !important }
      }`}</style>
    </>
  )
}

export default function Page() {
  return (
    <HrPage icon={Receipt} title="hr_slip_title" subtitle="hr_slip_sub" perm="hr.payroll">
      <Suspense fallback={<Loader />}>
        <Content />
      </Suspense>
    </HrPage>
  )
}
