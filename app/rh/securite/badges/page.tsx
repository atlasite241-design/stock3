'use client'

// Badges : le code physique qui identifie une personne au pointage.
// Un employé peut en avoir plusieurs dans l'historique (perte, remplacement),
// mais un seul actif — sinon deux badges pointeraient la même personne.

import { useState } from 'react'
import { ContactRound, Plus, Power, Printer, Trash2 } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { todayISO, type Badge } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { useLanguage } from '@/lib/i18n'

export default function Page() {
  const badges = useHrList<Badge>('badges')
  const { employees, nameOf, byId } = useEmployees()
  const { t } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ employeeId: '', code: '', note: '' })

  const suggestCode = (employeeId: string) => {
    const e = byId(employeeId)
    return e ? `BDG-${e.matricule.replace(/\D/g, '') || '000'}` : ''
  }

  const issue = () => {
    if (!f.employeeId || !f.code.trim()) return
    if (badges.all.some((b) => b.code === f.code.trim() && b.active)) {
      toast(t('hr_bdg_dup'))
      return
    }
    // Désactive l'ancien badge dans la même écriture : deux badges actifs pour
    // une personne rendraient le pointage ambigu.
    const next = badges.all.map((b) => (b.employeeId === f.employeeId && b.active ? { ...b, active: false } : b))
    badges.replaceAll([
      { id: `bdg_${Date.now().toString(36)}`, employeeId: f.employeeId, code: f.code.trim(), issuedAt: todayISO(), active: true, note: f.note || undefined },
      ...next,
    ])
    setOpen(false)
    setF({ employeeId: '', code: '', note: '' })
    toast(`✓ ${t('hr_saved')}`)
  }

  const columns: HrColumn<Badge>[] = [
    { key: 'code', label: t('hr_bdg_code'), value: (b) => b.code, render: (b) => <span className="font-mono font-bold text-gray-900 dark:text-white">{b.code}</span> },
    { key: 'emp', label: t('hr_col_employee'), value: (b) => nameOf(b.employeeId) },
    { key: 'issued', label: t('hr_bdg_issued'), value: (b) => b.issuedAt },
    {
      key: 'active', label: t('hr_col_status'), align: 'center',
      value: (b) => (b.active ? t('hr_active') : t('hr_inactive')),
      render: (b) => (
        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
          b.active
            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
            : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-zinc-400'
        }`}>
          {b.active ? t('hr_active') : t('hr_inactive')}
        </span>
      ),
    },
    { key: 'note', label: t('hr_col_detail'), value: (b) => b.note ?? '—' },
    {
      key: 'act', label: '', meta: true, align: 'right', value: () => '',
      render: (b) => (
        <span className="flex justify-end gap-1">
          <button
            onClick={() => badges.update(b.id, { active: !b.active })}
            title={b.active ? t('hr_bdg_revoke') : t('hr_bdg_restore')}
            className={`rounded-lg p-1.5 transition-colors ${b.active ? 'text-gray-400 hover:text-rose-500' : 'text-gray-300 hover:text-emerald-500'}`}
          >
            <Power className="h-4 w-4" />
          </button>
          <button onClick={() => badges.remove(b.id)} className="rounded-lg p-1.5 text-gray-300 transition-colors hover:text-rose-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </span>
      ),
    },
  ]

  const activeBadges = badges.items.filter((b) => b.active)
  const withoutBadge = employees.filter((e) => e.active && !activeBadges.some((b) => b.employeeId === e.id))

  return (
    <HrPage
      icon={ContactRound}
      title="hr_bdg_title"
      subtitle="hr_bdg_sub"
      perm="hr.badges"
      actions={
        <>
          <button onClick={() => window.print()} className="btn-secondary"><Printer className="h-4 w-4" />{t('hr_bdg_print')}</button>
          <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t('hr_bdg_new')}</button>
        </>
      }
    >
      <HrStats
        cards={[
          { label: t('hr_bdg_active'), value: String(activeBadges.length) },
          { label: t('hr_col_records'), value: String(badges.items.length) },
          { label: t('hr_bdg_missing'), value: String(withoutBadge.length), tone: withoutBadge.length ? 'text-orange-600 dark:text-orange-400' : undefined },
          { label: t('hr_col_employees'), value: String(employees.filter((e) => e.active).length) },
        ]}
      />

      {withoutBadge.length > 0 && (
        <p className="rounded-xl border border-dashed border-orange-200 bg-orange-50/50 p-3 text-xs text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/[0.06] dark:text-orange-300">
          <b>{t('hr_bdg_missing')} :</b> {withoutBadge.map((e) => e.name).join(' · ')}
        </p>
      )}

      <HrTable
        rows={badges.items}
        columns={columns}
        search={(b) => `${b.code} ${nameOf(b.employeeId)}`}
        filename="badges"
        empty={t('hr_bdg_empty')}
        defaultSort={{ key: 'code', dir: 'asc' }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t('hr_bdg_new')} closeOnBackdrop={false}>
        <div className="space-y-3">
          <Select
            value={f.employeeId}
            onChange={(v) => setF({ ...f, employeeId: v, code: f.code || suggestCode(v) })}
            placeholder={t('hr_col_employee')}
            options={employees.map((e) => ({ value: e.id, label: `${e.matricule} — ${e.name}` }))}
          />
          <input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder={t('hr_bdg_code')} className="input-field font-mono" />
          <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={t('hr_col_detail')} className="input-field" />
          <p className="rounded-xl border border-dashed border-gray-200 p-3 text-[11px] text-gray-500 dark:border-white/15 dark:text-zinc-400">
            {t('hr_bdg_hint')}
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button onClick={issue} disabled={!f.employeeId || !f.code.trim()} className="btn-primary disabled:opacity-40">{t('hr_create')}</button>
          </div>
        </div>
      </Modal>
    </HrPage>
  )
}
