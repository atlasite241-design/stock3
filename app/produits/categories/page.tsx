'use client'

import { FolderTree } from 'lucide-react'
import AppShell from '@/components/AppShell'
import AttributCrud from '@/components/AttributCrud'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, categories, categoryActions } = useDroguerie()
  const { t } = useLanguage()
  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
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
