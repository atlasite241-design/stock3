'use client'

import { FolderTree } from 'lucide-react'
import AppShell from '@/components/AppShell'
import AttributCrud from '@/components/AttributCrud'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, subcategories, subcategoryActions } = useDroguerie()
  const { t } = useLanguage()
  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }
  return (
    <AttributCrud
      title={t('subcat_title')}
      subtitle={t('subcat_subtitle')}
      newPlaceholder={t('subcat_new_placeholder')}
      icon={FolderTree}
      items={subcategories}
      usageOf={(name) => products.filter((p) => p.category === name).length}
      actions={subcategoryActions}
    />
  )
}

export default function SousCategoriesPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
