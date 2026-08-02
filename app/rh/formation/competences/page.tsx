'use client'

// Compétences : qui sait faire quoi, et à quel niveau. Sert à savoir qui peut
// remplacer qui — la vraie question quand quelqu'un manque.

import { useMemo, useState } from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import type { Skill } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { useLanguage, type TKey } from '@/lib/i18n'

const LEVELS: { value: 1 | 2 | 3 | 4; key: TKey }[] = [
  { value: 1, key: 'hr_sk_l1' },
  { value: 2, key: 'hr_sk_l2' },
  { value: 3, key: 'hr_sk_l3' },
  { value: 4, key: 'hr_sk_l4' },
]

const SUGGESTED = [
  'Caisse', 'Conseil client', 'Découpe de verre', 'Mélange de peinture',
  'Réception marchandise', 'Inventaire', 'Manutention', 'Négociation fournisseur',
  'Informatique', 'Arabe', 'Français',
]

export default function Page() {
  const skills = useHrList<Skill>('skills')
  const { active: employees, nameOf } = useEmployees()
  const { t } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<{ employeeId: string; name: string; level: 1 | 2 | 3 | 4 }>({ employeeId: '', name: '', level: 2 })

  const levelLabel = (n: number) => t(LEVELS.find((l) => l.value === n)?.key ?? 'hr_sk_l1')

  /** Compétences détenues par au plus une personne : le point de fragilité. */
  const fragile = useMemo(() => {
    const byName = new Map<string, Set<string>>()
    for (const s of skills.items) {
      if (s.level < 3) continue // il faut être autonome pour compter comme relais
      const set = byName.get(s.name) ?? new Set<string>()
      set.add(s.employeeId)
      byName.set(s.name, set)
    }
    return [...byName.entries()].filter(([, who]) => who.size <= 1).map(([name]) => name)
  }, [skills.items])

  const columns: HrColumn<Skill>[] = [
    { key: 'emp', label: t('hr_col_employee'), value: (s) => nameOf(s.employeeId) },
    { key: 'name', label: t('hr_sk_name'), value: (s) => s.name },
    {
      key: 'level', label: t('hr_sk_level'), align: 'center',
      value: (s) => s.level,
      render: (s) => (
        <span className="inline-flex items-center gap-2">
          <span className="flex gap-0.5">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={`h-2 w-5 rounded-sm ${i <= s.level ? 'bg-amber-500' : 'bg-gray-200 dark:bg-white/10'}`} />
            ))}
          </span>
          <span className="text-xs text-gray-500">{levelLabel(s.level)}</span>
        </span>
      ),
    },
    {
      key: 'del', label: '', meta: true, align: 'right', value: () => '',
      render: (s) => (
        <button onClick={() => skills.remove(s.id)} className="text-gray-300 transition-colors hover:text-rose-500">
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <HrPage
      icon={Sparkles}
      title="hr_sk_title"
      subtitle="hr_sk_sub"
      perm="hr.training"
      actions={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t('hr_sk_new')}</button>}
    >
      <HrStats
        cards={[
          { label: t('hr_col_records'), value: String(skills.items.length) },
          { label: t('hr_sk_distinct'), value: String(new Set(skills.items.map((s) => s.name)).size) },
          { label: t('hr_col_employees'), value: String(new Set(skills.items.map((s) => s.employeeId)).size) },
          { label: t('hr_sk_fragile'), value: String(fragile.length), tone: fragile.length ? 'text-orange-600 dark:text-orange-400' : undefined },
        ]}
      />

      {fragile.length > 0 && (
        <p className="rounded-xl border border-dashed border-orange-200 bg-orange-50/50 p-3 text-xs text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/[0.06] dark:text-orange-300">
          <b>{t('hr_sk_fragile')} :</b> {fragile.join(' · ')} — {t('hr_sk_fragile_hint')}
        </p>
      )}

      <HrTable
        rows={skills.items}
        columns={columns}
        search={(s) => `${nameOf(s.employeeId)} ${s.name}`}
        filename="competences"
        empty={t('hr_sk_empty')}
        defaultSort={{ key: 'name', dir: 'asc' }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t('hr_sk_new')} closeOnBackdrop={false}>
        <div className="space-y-3">
          <Select
            value={f.employeeId}
            onChange={(v) => setF({ ...f, employeeId: v })}
            placeholder={t('hr_col_employee')}
            options={employees.map((e) => ({ value: e.id, label: `${e.matricule} — ${e.name}` }))}
          />
          <Select value={f.name} onChange={(v) => setF({ ...f, name: v })} options={SUGGESTED} placeholder={t('hr_sk_name')} />
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t('hr_sk_name')} className="input-field" />
          <div>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_sk_level')}</span>
            <div className="flex flex-wrap gap-1.5">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setF({ ...f, level: l.value })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    f.level === l.value ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-zinc-400'
                  }`}
                >
                  {t(l.key)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button
              onClick={() => {
                if (!f.employeeId || !f.name.trim()) return
                skills.add({ employeeId: f.employeeId, name: f.name.trim(), level: f.level })
                setOpen(false)
                setF({ employeeId: '', name: '', level: 2 })
                toast(`✓ ${t('hr_saved')}`)
              }}
              disabled={!f.employeeId || !f.name.trim()}
              className="btn-primary disabled:opacity-40"
            >
              {t('hr_create')}
            </button>
          </div>
        </div>
      </Modal>
    </HrPage>
  )
}
