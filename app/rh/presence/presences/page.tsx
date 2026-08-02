'use client'

import { CalendarCheck } from 'lucide-react'
import AttendanceView from '@/components/hr/AttendanceView'

export default function Page() {
  return (
    <AttendanceView
      icon={CalendarCheck}
      title="hr_pres_title"
      subtitle="hr_pres_sub"
      empty="hr_pres_empty"
      filter={(a) => a.status === 'present'}
      filename="presences"
    />
  )
}
