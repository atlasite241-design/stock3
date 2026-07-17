'use client'

import { Ruler } from 'lucide-react'
import AppShell from '@/components/AppShell'
import AttributCrud from '@/components/AttributCrud'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, units, unitActions } = useDroguerie()
  const { t } = useLanguage()
  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }
  return (
    <AttributCrud
      title={t('units_title')}
      subtitle={t('units_subtitle')}
      newPlaceholder={t('units_new_placeholder')}
      icon={Ruler}
      items={units}
      usageOf={(name) => products.filter((p) => p.unit === name).length}
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
