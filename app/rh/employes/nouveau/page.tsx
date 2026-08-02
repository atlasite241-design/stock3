'use client'

import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import HrPage from '@/components/hr/HrPage'
import EmployeeForm from '@/components/hr/EmployeeForm'
import { useToast } from '@/components/Toast'
import { useEmployees } from '@/lib/hr-employees'

export default function Page() {
  const { all, create } = useEmployees()
  const router = useRouter()
  const toast = useToast()

  return (
    <HrPage icon={UserPlus} title="hr_new_title" subtitle="hr_new_sub" perm="hr.edit">
      <div className="glass-card p-5 sm:p-6">
        <EmployeeForm
          existing={all}
          onCancel={() => router.push('/rh/employes')}
          onSubmit={(data) => {
            const e = create(data)
            toast(`✓ ${e.name} — ${e.matricule}`)
            router.push(`/rh/employes/dossier?id=${e.id}`)
          }}
        />
      </div>
    </HrPage>
  )
}
