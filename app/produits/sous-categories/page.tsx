'use client'

import { useMemo } from 'react'
import { FolderTree } from 'lucide-react'
import Loader from '@/components/Loader'
import AppShell from '@/components/AppShell'
import AttributCrud from '@/components/AttributCrud'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, subcategories, subcategoryActions } = useDroguerie()
  const { t } = useLanguage()

  // Comptage en un seul passage sur le catalogue. Avant, chaque ligne relançait
  // un filter() complet : ~300 sous-catégories x 55 000 produits par rendu.
  const { byPair, bySub } = useMemo(() => {
    const byPair = new Map<string, number>()
    const bySub = new Map<string, number>()
    for (const p of products) {
      const sub = p.subcategory ?? ''
      if (!sub) continue
      const pair = `${p.category}›${sub}`
      byPair.set(pair, (byPair.get(pair) ?? 0) + 1)
      bySub.set(sub, (bySub.get(sub) ?? 0) + 1)
    }
    return { byPair, bySub }
  }, [products])

  if (!ready) {
    return <Loader />
  }
  return (
    <AttributCrud
      title={t('subcat_title')}
      subtitle={t('subcat_subtitle')}
      newPlaceholder={t('subcat_new_placeholder')}
      icon={FolderTree}
      items={subcategories}
      usageOf={(name) => {
        // name au format « Catégorie › Sous-catégorie »
        const [cat, sub] = name.split('›').map((s) => s.trim())
        if (!sub) return bySub.get(cat) ?? 0
        return byPair.get(`${cat}›${sub}`) ?? 0
      }}
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
