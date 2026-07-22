'use client'

import { useMemo } from 'react'
import { FolderTree } from 'lucide-react'
import Loader from '@/components/Loader'
import AppShell from '@/components/AppShell'
import AttributCrud from '@/components/AttributCrud'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, categories, categoryActions } = useDroguerie()
  const { t } = useLanguage()
  // Comptage en un seul passage : un filter() par ligne coûtait
  // (nb catégories x nb produits) comparaisons à chaque rendu.
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) m.set(p.category, (m.get(p.category) ?? 0) + 1)
    return m
  }, [products])
  if (!ready) {
    return <Loader />
  }
  return (
    <AttributCrud
      title={t('cat_title')}
      subtitle={t('cat_subtitle')}
      newPlaceholder={t('cat_new_placeholder')}
      icon={FolderTree}
      items={categories}
      usageOf={(name) => counts.get(name) ?? 0}
      actions={categoryActions}
    />
  )
}

export default function CategoriesPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
