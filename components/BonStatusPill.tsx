'use client'

import { BON_STATUS_META, type BonStatus } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

export const BON_STATUS_KEY: Record<BonStatus, TKey> = {
  cree: 'bon_st_cree',
  attente: 'bon_st_attente',
  encours: 'bon_st_encours',
  saisi: 'bon_st_saisi',
  annule: 'bon_st_annule',
}

export default function BonStatusPill({ status }: { status: BonStatus }) {
  const { t } = useLanguage()
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${BON_STATUS_META[status].chip}`}>
      {t(BON_STATUS_KEY[status])}
    </span>
  )
}
