'use client'

import { Rows3 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import LocationManager from '@/components/LocationManager'
import { useLanguage } from '@/lib/i18n'

export default function RayonsPage() {
  const { t } = useLanguage()
  return (
    <AppShell>
      <LocationManager level="rayon" icon={Rows3} title={t('wms_rayons_title')} subtitle={t('wms_rayons_subtitle')} codePlaceholder="03" />
    </AppShell>
  )
}
