'use client'

// Équipes : qui travaille avec qui, sur quel horaire. C'est le lien qui donne
// un horaire de référence à chaque personne lors du pointage.

import { useState } from 'react'
import { Plus, Trash2, UsersRound } from 'lucide-react'
import HrPage from '@/components/hr/HrPage'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import type { Shift, Team } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { useLanguage } from '@/lib/i18n'

export default function Page() {
  const teams = useHrList<Team>('teams')
  const shifts = useHrList<Shift>('shifts')
  const { active: employees, nameOf } = useEmployees()
  const { t } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Team | null>(null)
  const [f, setF] = useState<{ name: string; shiftId: string; leaderId: string; memberIds: string[] }>({
    name: '', shiftId: '', leaderId: '', memberIds: [],
  })

  const start = (team?: Team) => {
    setEditing(team ?? null)
    setF({
      name: team?.name ?? '',
      shiftId: team?.shiftId ?? '',
      leaderId: team?.leaderId ?? '',
      memberIds: team?.memberIds ?? [],
    })
    setOpen(true)
  }

  const toggleMember = (id: string) =>
    setF((p) => ({ ...p, memberIds: p.memberIds.includes(id) ? p.memberIds.filter((x) => x !== id) : [...p.memberIds, id] }))

  const save = () => {
    if (!f.name.trim()) return
    const data = {
      name: f.name.trim(),
      shiftId: f.shiftId || undefined,
      leaderId: f.leaderId || undefined,
      memberIds: f.memberIds,
    }
    if (editing) teams.update(editing.id, data)
    else teams.add(data)
    setOpen(false)
    toast(`✓ ${t('hr_saved')}`)
  }

  // Une personne ne peut appartenir qu'à une équipe : deux équipes signifieraient
  // deux horaires de référence le même jour, donc un retard incalculable.
  const takenBy = (employeeId: string) =>
    teams.items.find((x) => x.id !== editing?.id && x.memberIds.includes(employeeId))

  return (
    <HrPage
      icon={UsersRound}
      title="hr_tm_title"
      subtitle="hr_tm_sub"
      perm="hr.planning"
      actions={<button onClick={() => start()} className="btn-primary"><Plus className="h-4 w-4" />{t('hr_tm_new')}</button>}
    >
      {teams.items.length === 0 ? (
        <p className="glass-card p-12 text-center text-sm text-gray-500 dark:text-zinc-400">{t('hr_tm_empty')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.items.map((team) => {
            const shift = shifts.items.find((s) => s.id === team.shiftId)
            return (
              <div key={team.id} className="glass-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{team.name}</p>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500">
                      {shift ? `${shift.name} · ${shift.start}–${shift.end}` : t('hr_tm_no_shift')}
                    </p>
                  </div>
                  <button onClick={() => teams.remove(team.id)} className="text-gray-300 transition-colors hover:text-rose-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {team.leaderId && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
                    {t('hr_tm_leader')} : <b className="text-gray-900 dark:text-white">{nameOf(team.leaderId)}</b>
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-1">
                  {team.memberIds.map((id) => (
                    <span key={id} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/10 dark:text-zinc-300">
                      {nameOf(id)}
                    </span>
                  ))}
                  {team.memberIds.length === 0 && <span className="text-[11px] text-gray-400">{t('hr_tm_no_member')}</span>}
                </div>

                <button onClick={() => start(team)} className="btn-secondary mt-3 w-full justify-center">{t('hr_edit')}</button>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? editing.name : t('hr_tm_new')} closeOnBackdrop={false}>
        <div className="space-y-3">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t('hr_tm_name')} className="input-field" autoFocus />
          <Select
            value={f.shiftId}
            onChange={(v) => setF({ ...f, shiftId: v })}
            placeholder={t('hr_tm_shift')}
            options={shifts.items.map((s) => ({ value: s.id, label: `${s.name} (${s.start}–${s.end})` }))}
          />
          <Select
            value={f.leaderId}
            onChange={(v) => setF({ ...f, leaderId: v })}
            placeholder={t('hr_tm_leader')}
            options={employees.map((e) => ({ value: e.id, label: e.name }))}
          />
          <div>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_tm_members')}</span>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 p-1 dark:border-white/10">
              {employees.map((e) => {
                const other = takenBy(e.id)
                return (
                  <label key={e.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${other ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                    <input
                      type="checkbox"
                      checked={f.memberIds.includes(e.id)}
                      onChange={() => !other && toggleMember(e.id)}
                      disabled={!!other}
                      className="h-4 w-4 accent-amber-500"
                    />
                    <span className="flex-1 text-sm text-gray-700 dark:text-zinc-200">{e.name}</span>
                    {other && <span className="text-[10px] text-gray-400">{other.name}</span>}
                  </label>
                )
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button onClick={save} disabled={!f.name.trim()} className="btn-primary disabled:opacity-40">
              {editing ? t('hr_save') : t('hr_create')}
            </button>
          </div>
        </div>
      </Modal>
    </HrPage>
  )
}
