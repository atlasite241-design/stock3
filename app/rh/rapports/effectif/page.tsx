'use client'

// Effectif : combien de personnes, réparties comment. Le chiffre que demande
// la CNSS, l'inspection du travail et le comptable.

import { useMemo } from 'react'
import { PieChart } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import { HR_CONTRACTS } from '@/lib/hr'
import { useEmployees } from '@/lib/hr-employees'
import { useLanguage } from '@/lib/i18n'

interface Bucket {
  id: string
  group: string
  label: string
  count: number
  share: number
}

export default function Page() {
  const { employees } = useEmployees()
  const { t, lang } = useLanguage()

  const active = useMemo(() => employees.filter((e) => e.active), [employees])

  const buckets = useMemo<Bucket[]>(() => {
    const out: Bucket[] = []
    const total = active.length || 1
    const push = (group: string, map: Map<string, number>) => {
      for (const [label, count] of [...map.entries()].sort((a, b) => b[1] - a[1])) {
        out.push({ id: `${group}_${label}`, group, label, count, share: Math.round((count / total) * 100) })
      }
    }
    const count = (fn: (e: (typeof active)[number]) => string) => {
      const m = new Map<string, number>()
      for (const e of active) {
        const k = fn(e) || '—'
        m.set(k, (m.get(k) ?? 0) + 1)
      }
      return m
    }
    push(t('hr_f_contract'), count((e) => HR_CONTRACTS.find((c) => c.value === e.contract)?.[lang] ?? e.contract))
    push(t('hr_f_poste'), count((e) => e.poste))
    push(t('hr_f_dept'), count((e) => e.departement ?? '—'))
    push(t('hr_f_role'), count((e) => e.role))
    push(t('hr_eff_seniority'), count((e) => {
      const years = (Date.now() - new Date(e.hireDate).getTime()) / (365.25 * 86400000)
      if (!Number.isFinite(years)) return '—'
      return years < 1 ? t('hr_eff_y0') : years < 3 ? t('hr_eff_y1') : years < 5 ? t('hr_eff_y3') : t('hr_eff_y5')
    }))
    return out
  }, [active, t, lang])

  const columns: HrColumn<Bucket>[] = [
    { key: 'group', label: t('hr_eff_axis'), value: (b) => b.group },
    { key: 'label', label: t('hr_eff_value'), value: (b) => b.label },
    { key: 'count', label: t('hr_col_employees'), align: 'center', value: (b) => b.count },
    {
      key: 'share', label: t('rp_vd_share'), align: 'right',
      value: (b) => b.share,
      render: (b) => (
        <span className="flex items-center justify-end gap-2">
          <span className="tabular-nums text-xs text-gray-500">{b.share} %</span>
          <span className="h-2 w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <span className="block h-full rounded-full bg-amber-500" style={{ width: `${b.share}%` }} />
          </span>
        </span>
      ),
    },
  ]

  const thisYear = String(new Date().getFullYear())

  return (
    <HrPage icon={PieChart} title="hr_eff_title" subtitle="hr_eff_sub" perm="hr.reports">
      <HrStats
        cards={[
          { label: t('hr_eff_active'), value: String(active.length) },
          { label: t('hr_eff_total'), value: String(employees.length) },
          { label: t('hr_eff_in'), value: String(employees.filter((e) => e.hireDate.startsWith(thisYear)).length), tone: 'text-emerald-600 dark:text-emerald-400' },
          { label: t('hr_eff_out'), value: String(employees.filter((e) => e.endDate?.startsWith(thisYear)).length), tone: 'text-rose-600 dark:text-rose-400' },
        ]}
      />

      <HrTable
        rows={buckets}
        columns={columns}
        search={(b) => `${b.group} ${b.label}`}
        filename="effectif"
        empty={t('hr_eff_empty')}
      />
    </HrPage>
  )
}
