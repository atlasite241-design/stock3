'use client'

import { FolderTree } from 'lucide-react'
import Loader from '@/components/Loader'
import AppShell from '@/components/AppShell'
import AttributCrud from '@/components/AttributCrud'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, categories, categoryActions } = useDroguerie()
  const { t } = useLanguage()
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
      usageOf={(name) => products.filter((p) => p.category === name).length}
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
