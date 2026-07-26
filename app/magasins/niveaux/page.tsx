'use client'

import { AlignJustify } from 'lucide-react'
import AppShell from '@/components/AppShell'
import LocationManager from '@/components/LocationManager'
import { useLanguage } from '@/lib/i18n'

export default function NiveauxPage() {
  const { t } = useLanguage()
  return (
    <AppShell>
      <LocationManager level="niveau" icon={AlignJustify} title={t('wms_niveaux_title')} subtitle={t('wms_niveaux_subtitle')} codePlaceholder="02" />
    </AppShell>
  )
}
