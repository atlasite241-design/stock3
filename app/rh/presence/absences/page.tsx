'use client'

import { CalendarX } from 'lucide-react'
import AttendanceView from '@/components/hr/AttendanceView'

export default function Page() {
  return (
    <AttendanceView
      icon={CalendarX}
      title="hr_abs_title"
      subtitle="hr_abs_sub"
      empty="hr_abs_empty"
      // Absence = journée non travaillée et non couverte par un congé validé.
      // Les congés ont leur propre écran : les mélanger fausserait le décompte.
      filter={(a) => a.status === 'absent'}
      filename="absences"
    />
  )
}
