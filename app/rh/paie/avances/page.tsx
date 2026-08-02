'use client'

import { HandCoins } from 'lucide-react'
import AdjustmentsView from '@/components/hr/AdjustmentsView'

const PRESETS = ['Avance sur salaire', 'Acompte', 'Prêt personnel']

export default function Page() {
  return (
    <AdjustmentsView
      kind="avance"
      icon={HandCoins}
      title="hr_adv_title"
      subtitle="hr_adv_sub"
      empty="hr_adv_empty"
      newLabel="hr_adv_new"
      filename="avances"
      presets={PRESETS}
    />
  )
}
