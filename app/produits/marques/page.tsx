'use client'

import { useMemo } from 'react'
import { Tag } from 'lucide-react'
import Loader from '@/components/Loader'
import AppShell from '@/components/AppShell'
import AttributCrud from '@/components/AttributCrud'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, brands, brandActions } = useDroguerie()
  const { t } = useLanguage()
  // Comptage en un seul passage (voir /produits/categories).
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) if (p.brand) m.set(p.brand, (m.get(p.brand) ?? 0) + 1)
    return m
  }, [products])
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
      usageOf={(name) => counts.get(name) ?? 0}
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
