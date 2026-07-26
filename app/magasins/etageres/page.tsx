'use client'

import { Layers } from 'lucide-react'
import AppShell from '@/components/AppShell'
import LocationManager from '@/components/LocationManager'
import { useLanguage } from '@/lib/i18n'

export default function EtageresPage() {
  const { t } = useLanguage()
  return (
    <AppShell>
      <LocationManager level="etagere" icon={Layers} title={t('wms_etageres_title')} subtitle={t('wms_etageres_subtitle')} codePlaceholder="04" />
    </AppShell>
  )
}
