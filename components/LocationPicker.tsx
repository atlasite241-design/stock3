'use client'

import { useMemo } from 'react'
import Select from '@/components/Select'
import { buildEmplacementCode, depotShortCode, storeShortCode, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export interface ProductLocation {
  depotId?: string
  zoneId?: string
  alleeId?: string
  rayonId?: string
  etagereId?: string
  niveauId?: string
  positionId?: string
  emplacementComplet?: string
}

/**
 * Sélecteur d'emplacement pour la fiche produit : Dépôt puis 6 menus en cascade
 * (Zone → Allée → Rayon → Étagère → Niveau → Position), scopés au magasin du
 * produit. Recalcule `emplacementComplet` (MAG01-DEP01-A-02-…) à chaque changement.
 */
export default function LocationPicker({
  storeId,
  value,
  onChange,
}: {
  storeId: string
  value: ProductLocation
  onChange: (loc: ProductLocation) => void
}) {
  const d = useDroguerie()
  const { t } = useLanguage()

  const storeCode = useMemo(() => {
    const idx = d.stores.findIndex((s) => s.id === storeId)
    return storeShortCode(idx < 0 ? 0 : idx)
  }, [d.stores, storeId])

  const storeDepots = useMemo(() => d.depots.filter((x) => x.storeId === storeId), [d.depots, storeId])
  const firstDepotId = storeDepots[0]?.id
  // Dépôt courant : choisi, sinon celui de la zone, sinon le dépôt principal.
  const zoneDepotId = d.zones.find((z) => z.id === value.zoneId)?.depotId
  const depotId = value.depotId ?? zoneDepotId ?? firstDepotId ?? ''
  const depotCode = useMemo(() => {
    const idx = storeDepots.findIndex((x) => x.id === depotId)
    const dep = storeDepots.find((x) => x.id === depotId)
    return dep?.code || depotShortCode(idx < 0 ? 0 : idx)
  }, [storeDepots, depotId])

  // Niveaux : clé du champ id + collection + champ parent + libellé.
  const levels = [
    { key: 'zoneId', items: d.zones, parent: '', pf: '', label: t('wms_zone') },
    { key: 'alleeId', items: d.allees, parent: 'zoneId', pf: 'zoneId', label: t('wms_allee') },
    { key: 'rayonId', items: d.rayons, parent: 'alleeId', pf: 'alleeId', label: t('wms_rayon') },
    { key: 'etagereId', items: d.etageres, parent: 'rayonId', pf: 'rayonId', label: t('wms_etagere') },
    { key: 'niveauId', items: d.niveaux, parent: 'etagereId', pf: 'etagereId', label: t('wms_niveau') },
    { key: 'positionId', items: d.positions, parent: 'niveauId', pf: 'niveauId', label: t('wms_position') },
  ] as const

  const idOf = (k: string) => (value as Record<string, string | undefined>)[k]

  const optionsFor = (li: number) => {
    const lvl = levels[li]
    return (lvl.items as { id: string; storeId: string; code: string; name?: string; depotId?: string }[])
      .filter((it) => it.storeId === storeId)
      // Zones : filtrées par dépôt (les zones sans dépôt tombent sous le dépôt principal).
      .filter((it) => li !== 0 || it.depotId === depotId || (!it.depotId && depotId === firstDepotId))
      .filter((it) => li === 0 || (it as Record<string, unknown>)[lvl.pf] === idOf(levels[li - 1].key))
      .sort((a, b) => a.code.localeCompare(b.code, 'fr'))
  }

  const emit = (next: ProductLocation) => {
    const codes = levels.map((lvl) => {
      const it = (lvl.items as { id: string; code: string }[]).find((x) => x.id === (next as Record<string, string | undefined>)[lvl.key])
      return it?.code
    })
    const dep = next.depotId ?? d.zones.find((z) => z.id === next.zoneId)?.depotId ?? firstDepotId
    const depIdx = storeDepots.findIndex((x) => x.id === dep)
    const depCode = storeDepots.find((x) => x.id === dep)?.code || (depIdx >= 0 ? depotShortCode(depIdx) : depotCode)
    const code = codes[0]
      ? buildEmplacementCode({ storeCode, depot: depCode, zone: codes[0], allee: codes[1], rayon: codes[2], etagere: codes[3], niveau: codes[4], position: codes[5] })
      : ''
    onChange({ ...next, emplacementComplet: code || undefined })
  }

  const pickDepot = (id: string) => {
    // Changer de dépôt réinitialise toute la cascade.
    emit({ depotId: id || undefined })
  }

  const pick = (li: number, id: string) => {
    const next: ProductLocation = { ...value, depotId, [levels[li].key]: id || undefined }
    for (let j = li + 1; j < levels.length; j++) (next as Record<string, string | undefined>)[levels[j].key] = undefined
    emit(next)
  }

  return (
    <div className="space-y-3">
      {storeDepots.length > 0 && (
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{t('wms_depot')}</label>
          <Select
            value={depotId}
            onChange={pickDepot}
            options={storeDepots.map((x, i) => ({ value: x.id, label: `${x.code || depotShortCode(i)} · ${x.name}` }))}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {levels.map((lvl, li) => {
          const disabled = li > 0 && !idOf(levels[li - 1].key)
          return (
            <div key={lvl.key}>
              <label className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{lvl.label}</label>
              <div className={disabled ? 'pointer-events-none opacity-40' : ''}>
                <Select
                  value={idOf(lvl.key) ?? ''}
                  onChange={(v) => pick(li, v)}
                  placeholder={`— ${lvl.label} —`}
                  options={[{ value: '', label: `— ${lvl.label} —` }, ...optionsFor(li).map((it) => ({ value: it.id, label: `${it.code}${it.name ? ' · ' + it.name : ''}` }))]}
                />
              </div>
            </div>
          )
        })}
      </div>
      {value.emplacementComplet && (
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          {t('wms_emplacement')} : <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{value.emplacementComplet}</span>
        </p>
      )}
    </div>
  )
}
