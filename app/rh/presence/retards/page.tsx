'use client'

import { AlarmClock } from 'lucide-react'
import AttendanceView from '@/components/hr/AttendanceView'
import { fmtHours } from '@/lib/hr'
import { useLanguage } from '@/lib/i18n'

export default function Page() {
  const { t } = useLanguage()
  return (
    <AttendanceView
      icon={AlarmClock}
      title="hr_late_title"
      subtitle="hr_late_sub"
      empty="hr_late_empty"
      // Un retard n'existe que si l'employé a un horaire : sans horaire de
      // référence, l'application n'a rien à quoi comparer l'heure d'arrivée.
      filter={(a) => a.lateMin > 0}
      filename="retards"
      extraColumns={[
        {
          key: 'late',
          label: t('hr_late'),
          align: 'right',
          value: (a) => a.lateMin,
          render: (a) => (
            <span className="font-bold tabular-nums text-orange-600 dark:text-orange-400">{fmtHours(a.lateMin)}</span>
          ),
        },
      ]}
    />
  )
}
