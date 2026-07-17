'use client'

import { Tag } from 'lucide-react'
import AppShell from '@/components/AppShell'
import AttributCrud from '@/components/AttributCrud'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, brands, brandActions } = useDroguerie()
  const { t } = useLanguage()
  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }
  return (
    <AttributCrud
      title={t('brand_title')}
      subtitle={t('brand_subtitle')}
      newPlaceholder={t('brand_new_placeholder')}
      icon={Tag}
      items={brands}
      usageOf={(name) => products.filter((p) => p.brand === name).length}
      actions={brandActions}
    />
  )
}

export default function MarquesPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
