'use client'

import { Gift } from 'lucide-react'
import AdjustmentsView from '@/components/hr/AdjustmentsView'

// Panier, transport et salissure sont exonérés dans certaines limites : la case
// « soumise à cotisations » existe pour ça.
const PRESETS = ['Prime d\u2019ancienneté', 'Prime de rendement', 'Prime exceptionnelle', 'Heures supplémentaires', 'Indemnité de transport', 'Indemnité de panier', 'Prime de responsabilité']

export default function Page() {
  return (
    <AdjustmentsView
      kind="prime"
      icon={Gift}
      title="hr_prime_title"
      subtitle="hr_prime_sub"
      empty="hr_prime_empty"
      newLabel="hr_prime_new"
      filename="primes"
      presets={PRESETS}
      allowExempt
    />
  )
}
