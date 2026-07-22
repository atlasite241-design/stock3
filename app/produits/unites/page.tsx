'use client'

import { useMemo } from 'react'
import { Ruler } from 'lucide-react'
import Loader from '@/components/Loader'
import AppShell from '@/components/AppShell'
import AttributCrud from '@/components/AttributCrud'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, units, unitActions } = useDroguerie()
  const { t } = useLanguage()
  // Comptage en un seul passage (voir /produits/categories).
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) if (p.unit) m.set(p.unit, (m.get(p.unit) ?? 0) + 1)
    return m
  }, [products])
  if (!ready) {
    return <Loader />
  }
  return (
    <AttributCrud
      title={t('units_title')}
      subtitle={t('units_subtitle')}
      newPlaceholder={t('units_new_placeholder')}
      icon={Ruler}
      items={units}
      usageOf={(name) => counts.get(name) ?? 0}
      actions={unitActions}
    />
  )
}

export default function UnitesPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
