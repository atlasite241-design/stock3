'use client'

import { useMemo } from 'react'
import { Tag } from 'lucide-react'
import Loader from '@/components/Loader'
import AppShell from '@/components/AppShell'
import AttributCrud from '@/components/AttributCrud'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, brands, brandActions, reconcileAttributesFromProducts } = useDroguerie()
  const { t } = useLanguage()
  // Comptage en un seul passage (voir /produits/categories).
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) if (p.brand) m.set(p.brand, (m.get(p.brand) ?? 0) + 1)
    return m
  }, [products])
  // Fusion : marques enregistrées + marques présentes dans les produits (importées)
  // mais pas encore dans la liste — pour tout afficher sans écriture.
  const items = useMemo(() => {
    const known = new Set(brands.map((b) => b.name))
    const extra = [...counts.keys()].filter((name) => name && !known.has(name)).sort((a, b) => a.localeCompare(b, 'fr'))
    return [...brands, ...extra.map((name) => ({ id: `sync:${name}`, name }))]
  }, [brands, counts])
  if (!ready) {
    return <Loader />
  }
  return (
    <AttributCrud
      title={t('brand_title')}
      subtitle={t('brand_subtitle')}
      newPlaceholder={t('brand_new_placeholder')}
      icon={Tag}
      items={items}
      usageOf={(name) => counts.get(name) ?? 0}
      actions={brandActions}
      onSync={reconcileAttributesFromProducts}
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
