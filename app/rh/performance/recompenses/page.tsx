'use client'

import { Award } from 'lucide-react'
import ActionsView from '@/components/hr/ActionsView'

const TYPES = ['Félicitations', 'Prime exceptionnelle', 'Employé du mois', 'Jour de congé offert', 'Promotion', 'Cadeau']

export default function Page() {
  return (
    <ActionsView
      kind="recompense"
      icon={Award}
      title="hr_rew_title"
      subtitle="hr_rew_sub"
      empty="hr_rew_empty"
      newLabel="hr_rew_new"
      filename="recompenses"
      types={TYPES}
      tone="text-emerald-600 dark:text-emerald-400"
    />
  )
}
