'use client'

import { Tag } from 'lucide-react'
import Loader from '@/components/Loader'
import AppShell from '@/components/AppShell'
import AttributCrud from '@/components/AttributCrud'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, brands, brandActions } = useDroguerie()
  const { t } = useLanguage()
  if (!ready) {
    return <Loader />
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
