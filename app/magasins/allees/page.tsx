'use client'

import { Route } from 'lucide-react'
import AppShell from '@/components/AppShell'
import LocationManager from '@/components/LocationManager'
import { useLanguage } from '@/lib/i18n'

export default function AlleesPage() {
  const { t } = useLanguage()
  return (
    <AppShell>
      <LocationManager level="allee" icon={Route} title={t('wms_allees_title')} subtitle={t('wms_allees_subtitle')} codePlaceholder="02" namePlaceholder={t('wms_allee_name_ph')} />
    </AppShell>
  )
}
