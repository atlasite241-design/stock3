'use client'

import { MapPin } from 'lucide-react'
import AppShell from '@/components/AppShell'
import LocationManager from '@/components/LocationManager'
import { useLanguage } from '@/lib/i18n'

// « Emplacement » = feuille de la hiérarchie (la Position), avec son code complet.
export default function EmplacementsPage() {
  const { t } = useLanguage()
  return (
    <AppShell>
      <LocationManager level="position" icon={MapPin} title={t('wms_emplacements_title')} subtitle={t('wms_emplacements_subtitle')} codePlaceholder="015" />
    </AppShell>
  )
}
