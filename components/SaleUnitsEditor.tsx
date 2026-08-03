'use client'

// Conditionnements de vente d'un produit.
//
// Le stock reste tenu dans l'unité de base. Chaque ligne ajoute une façon de
// VENDRE le même article : sachet, boîte, carton — avec son facteur et son
// propre prix. Le prix n'est jamais calculé depuis l'unité de base : un carton
// de 2 000 vis ne se vend pas 2 000 fois le prix pièce.

import { Plus, Trash2 } from 'lucide-react'
import { uid, fmtDH, type SaleUnit } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const PRESETS = [
  { name: 'Sachet de 10', factor: 10 },
  { name: 'Sachet de 20', factor: 20 },
  { name: 'Sachet de 50', factor: 50 },
  { name: 'Boîte de 100', factor: 100 },
  { name: 'Boîte de 250', factor: 250 },
  { name: 'Carton', factor: 1000 },
]

export default function SaleUnitsEditor({
  baseUnit,
  basePrice,
  value,
  onChange,
}: {
  baseUnit: string
  basePrice: number
  value: SaleUnit[]
  onChange: (next: SaleUnit[]) => void
}) {
  const { t } = useLanguage()

  const add = (name = '', factor = 0) =>
    onChange([...value, { id: uid(), name, factor, price: 0, barcode: '' }])

  const patch = (id: string, p: Partial<SaleUnit>) =>
    onChange(value.map((u) => (u.id === id ? { ...u, ...p } : u)))

  const remove = (id: string) => onChange(value.filter((u) => u.id !== id))

  return (
    <div className="rounded-xl border border-gray-200 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{t('su_title')}</p>
          <p className="text-[11px] text-gray-500 dark:text-zinc-400">
            {t('su_base')} <b className="text-gray-900 dark:text-white">{baseUnit || t('pos_unit_piece')}</b> · {fmtDH(basePrice)}
          </p>
        </div>
        <button type="button" onClick={() => add()} className="btn-secondary !h-8 text-xs">
          <Plus className="h-3.5 w-3.5" />{t('su_add')}
        </button>
      </div>

      {value.length === 0 ? (
        <>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-zinc-400">{t('su_empty')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => add(p.name, p.factor)}
                className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600 transition hover:bg-amber-100 hover:text-amber-800 dark:bg-white/10 dark:text-zinc-300"
              >
                + {p.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-3 space-y-2">
          {value.map((u) => {
            // Repère commercial : ce que coûterait le conditionnement au prix
            // pièce. Au-dessus, la remise de volume est absente ou inversée.
            const equivalent = basePrice * (u.factor || 0)
            const remise = equivalent > 0 && u.price > 0 ? ((equivalent - u.price) / equivalent) * 100 : null
            return (
              <div key={u.id} className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-2 dark:bg-white/5 sm:grid-cols-12">
                <input
                  value={u.name}
                  onChange={(e) => patch(u.id, { name: e.target.value })}
                  placeholder={t('su_name')}
                  className="input-field !h-9 text-sm sm:col-span-4"
                />
                <input
                  type="number" min={1} step={1} value={u.factor || ''}
                  onChange={(e) => patch(u.id, { factor: Math.max(0, Number(e.target.value)) })}
                  placeholder={t('su_factor')}
                  className="input-field !h-9 text-sm tabular-nums sm:col-span-2"
                />
                <input
                  type="number" min={0} step={0.01} value={u.price || ''}
                  onChange={(e) => patch(u.id, { price: Math.max(0, Number(e.target.value)) })}
                  placeholder={t('su_price')}
                  className="input-field !h-9 text-sm tabular-nums sm:col-span-2"
                />
                <input
                  value={u.barcode ?? ''}
                  onChange={(e) => patch(u.id, { barcode: e.target.value })}
                  placeholder={t('su_barcode')}
                  className="input-field !h-9 font-mono text-xs sm:col-span-3"
                />
                <button
                  type="button"
                  onClick={() => remove(u.id)}
                  className="flex h-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 sm:col-span-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <p className="col-span-2 text-[11px] tabular-nums text-gray-500 dark:text-zinc-400 sm:col-span-12">
                  {u.factor > 0 && (
                    <>
                      1 {u.name || t('su_name')} = <b className="text-gray-900 dark:text-white">{u.factor}</b> {baseUnit || t('pos_unit_piece')}
                      {equivalent > 0 && <> · {t('su_equiv')} {fmtDH(equivalent)}</>}
                      {remise !== null && (
                        <span className={remise >= 0 ? ' text-emerald-600 dark:text-emerald-400' : ' text-rose-600 dark:text-rose-400'}>
                          {' '}({remise >= 0 ? '−' : '+'}{Math.abs(remise).toFixed(1)} %)
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
            )
          })}
          <p className="text-[11px] leading-relaxed text-gray-500 dark:text-zinc-400">{t('su_hint')}</p>
        </div>
      )}
    </div>
  )
}
