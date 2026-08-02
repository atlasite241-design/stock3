'use client'

import { MinusCircle } from 'lucide-react'
import AdjustmentsView from '@/components/hr/AdjustmentsView'

// Ces retenues viennent APRÈS l'impôt : elles ne changent pas l'assiette,
// seulement le net à payer.
const PRESETS = ['Absence non justifiée', 'Retenue pour retard', 'Casse / manquant', 'Mutuelle', 'Retenue sur avance', 'Autre retenue']

export default function Page() {
  return (
    <AdjustmentsView
      kind="deduction"
      icon={MinusCircle}
      title="hr_ded_title"
      subtitle="hr_ded_sub"
      empty="hr_ded_empty"
      newLabel="hr_ded_new"
      filename="deductions"
      presets={PRESETS}
    />
  )
}
