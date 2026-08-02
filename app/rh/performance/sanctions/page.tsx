'use client'

import { TrendingDown } from 'lucide-react'
import ActionsView from '@/components/hr/ActionsView'

// Le code du travail marocain gradue les sanctions : avertissement, blâme,
// mise à pied, puis licenciement. L'ordre de cette liste suit cette gradation.
const TYPES = ['Avertissement verbal', 'Avertissement écrit', 'Blâme', 'Mise à pied', 'Retenue sur salaire', 'Licenciement']

export default function Page() {
  return (
    <ActionsView
      kind="sanction"
      icon={TrendingDown}
      title="hr_san_title"
      subtitle="hr_san_sub"
      empty="hr_san_empty"
      newLabel="hr_san_new"
      filename="sanctions"
      types={TYPES}
      tone="text-rose-600 dark:text-rose-400"
    />
  )
}
