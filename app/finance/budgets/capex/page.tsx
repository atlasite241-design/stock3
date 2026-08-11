'use client'

// Budget CAPEX : les investissements (équipements utilisés sur plusieurs
// années). Écart = montant réel − montant prévu, calculé, jamais saisi.
// Un investissement acheté ne se supprime pas — il s'annule ou reste.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { usePermissions } from '@/lib/access'
import {
  CAPEX_CATEGORIES,
  fmtDH,
  INVESTMENT_STATUS_META,
  useDroguerie,
  type Investment,
} from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const INV_STATUS_KEY: Record<Investment['status'], TKey> = {
  prevu: 'fin_cx_prevu',
  commande: 'fin_cx_commande',
  achete: 'fin_cx_achete',
  annule: 'fin_cx_annule',
}

const EMPTY = {
  designation: '', category: CAPEX_CATEGORIES[0], supplierId: '', planned: '', actual: '',
  plannedDate: '', purchaseDate: '', usefulLifeYears: '', responsable: '', note: '', status: 'prevu' as Investment['status'],
}

function Content() {
  const { ready, investments, suppliers, users, activeStore, addInvestment, updateInvestment, deleteInvestment } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()

  const nowYear = new Date().getFullYear()
  const [year, setYear] = useState(String(nowYear))
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null)

  const rows = useMemo(
    () => investments.filter((i) => i.year === Number(year)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [investments, year]
  )

  const totals = useMemo(() => {
    let planned = 0, actual = 0
    for (const i of rows) {
      if (i.status === 'annule') continue
      planned += i.planned
      actual += i.actual ?? 0
    }
    return { planned, actual, gap: actual - planned }
  }, [rows])

  if (!ready) return <Loader />

  const years = Array.from(new Set([nowYear, nowYear + 1, ...investments.map((i) => i.year)])).sort()

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setModalOpen(true) }
  const openEdit = (i: Investment) => {
    setEditingId(i.id)
    setForm({
      designation: i.designation, category: i.category, supplierId: i.supplierId ?? '',
      planned: String(i.planned), actual: i.actual !== undefined ? String(i.actual) : '',
      plannedDate: i.plannedDate, purchaseDate: i.purchaseDate ?? '',
      usefulLifeYears: i.usefulLifeYears !== undefined ? String(i.usefulLifeYears) : '',
      responsable: i.responsable ?? '', note: i.note ?? '', status: i.status,
    })
    setModalOpen(true)
  }

  const save = () => {
    if (!form.designation.trim()) { toast(t('fin_cx_toast_name'), 'error'); return }
    const planned = parseFloat(form.planned.replace(',', '.')) || 0
    if (planned <= 0) { toast(t('fin_toast_amount'), 'error'); return }
    const actual = form.actual.trim() ? parseFloat(form.actual.replace(',', '.')) || 0 : undefined
    const supplier = suppliers.find((s) => s.id === form.supplierId)
    const common = {
      designation: form.designation.trim(), category: form.category,
      supplierId: form.supplierId || undefined, supplierName: supplier?.name,
      planned, actual, plannedDate: form.plannedDate || `${year}-01-01`,
      purchaseDate: form.purchaseDate || undefined,
      usefulLifeYears: form.usefulLifeYears ? parseInt(form.usefulLifeYears) : undefined,
      responsable: form.responsable || undefined, note: form.note.trim() || undefined,
    }
    if (editingId) {
      updateInvestment(editingId, { ...common, status: form.status })
      toast(`✓ ${t('fin_toast_updated')}`)
    } else {
      const r = addInvestment({ ...common, year: Number(year) })
      toast(`✓ ${r.ref} ${t('fin_toast_created')}`)
    }
    setModalOpen(false)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Building2 className="h-6 w-6 text-amber-500" />
            {t('fin_capex_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('fin_capex_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={year} onChange={setYear} options={years.map((y) => ({ value: String(y), label: `${t('fin_exercice')} ${y}` }))} className="w-40" />
          {can('fin.budget_create') && (
            <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" />{t('fin_new_investment')}</button>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { v: fmtDH(totals.planned), l: t('fin_cx_kpi_planned'), c: 'text-gray-900 dark:text-white' },
          { v: fmtDH(totals.actual), l: t('fin_cx_kpi_actual'), c: 'text-amber-600 dark:text-amber-400' },
          { v: `${totals.gap > 0 ? '+' : ''}${fmtDH(totals.gap)}`, l: t('fin_cx_kpi_gap'), c: totals.gap > 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4 text-center">
            <p className={`truncate text-xl font-extrabold tabular-nums ${s.c}`}>{s.v}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-x-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Building2 className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('fin_capex_empty')}</p>
          </div>
        ) : (
          <table className="w-full min-w-[1020px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                <th className="px-4 py-3">{t('fin_col_ref')}</th>
                <th className="px-4 py-3">{t('fin_cx_designation')}</th>
                <th className="px-4 py-3">{t('fin_col_category')}</th>
                <th className="px-4 py-3">{t('fin_cx_supplier')}</th>
                <th className="px-4 py-3 text-right">{t('fin_col_planned')}</th>
                <th className="px-4 py-3 text-right">{t('fin_cx_actual')}</th>
                <th className="px-4 py-3 text-right">{t('fin_cx_gap')}</th>
                <th className="px-4 py-3">{t('fin_cx_dates')}</th>
                <th className="px-4 py-3">{t('fin_col_status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const gap = (i.actual ?? 0) - i.planned
                return (
                  <tr key={i.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-2.5 font-semibold text-amber-600 dark:text-amber-400">{i.ref}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">
                      {i.designation}
                      {i.usefulLifeYears ? <span className="ml-1 text-[10px] text-gray-400">({i.usefulLifeYears} {t('fin_cx_years')})</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{i.category}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{i.supplierName ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-zinc-300">{fmtDH(i.planned)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-white">{i.actual !== undefined ? fmtDH(i.actual) : '—'}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${i.actual === undefined ? 'text-gray-400' : gap > 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {i.actual === undefined ? '—' : `${gap > 0 ? '+' : ''}${fmtDH(gap)}`}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {new Date(i.plannedDate).toLocaleDateString('fr-FR')}
                      {i.purchaseDate && <> → {new Date(i.purchaseDate).toLocaleDateString('fr-FR')}</>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${INVESTMENT_STATUS_META[i.status].chip}`}>
                        {t(INV_STATUS_KEY[i.status])}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        {can('fin.budget_edit') && (
                          <button onClick={() => openEdit(i)} className="btn-secondary !px-2 !py-1"><Pencil className="h-3.5 w-3.5" /></button>
                        )}
                        {i.status !== 'achete' && can('fin.budget_delete') && (
                          <button onClick={() => setDeleteTarget(i)} className="btn-secondary !px-2 !py-1 !text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Création / édition */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('fin_edit_investment') : t('fin_new_investment')} maxWidth="max-w-lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label">{t('fin_cx_designation')}</label>
            <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="input-field" autoFocus />
          </div>
          <div>
            <label className="field-label">{t('fin_col_category')}</label>
            <Select value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={[...CAPEX_CATEGORIES]} />
          </div>
          <div>
            <label className="field-label">{t('fin_cx_supplier')}</label>
            <Select value={form.supplierId} onChange={(v) => setForm({ ...form, supplierId: v })}
              options={[{ value: '', label: '—' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
          </div>
          <div>
            <label className="field-label">{t('fin_col_planned')} (DH)</label>
            <input value={form.planned} onChange={(e) => setForm({ ...form, planned: e.target.value })} inputMode="decimal" className="input-field tabular-nums" />
          </div>
          <div>
            <label className="field-label">{t('fin_cx_actual')} (DH)</label>
            <input value={form.actual} onChange={(e) => setForm({ ...form, actual: e.target.value })} inputMode="decimal" className="input-field tabular-nums" placeholder="—" />
          </div>
          <div>
            <label className="field-label">{t('fin_cx_planned_date')}</label>
            <input type="date" value={form.plannedDate} onChange={(e) => setForm({ ...form, plannedDate: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="field-label">{t('fin_cx_purchase_date')}</label>
            <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="field-label">{t('fin_cx_life')}</label>
            <input value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value.replace(/\D/g, '') })} inputMode="numeric" className="input-field" />
          </div>
          <div>
            <label className="field-label">{t('fin_col_responsable')}</label>
            <Select value={form.responsable} onChange={(v) => setForm({ ...form, responsable: v })}
              options={[{ value: '', label: '—' }, ...users.filter((u) => u.active).map((u) => ({ value: u.name, label: u.name }))]} />
          </div>
          {editingId && (
            <div>
              <label className="field-label">{t('fin_col_status')}</label>
              <Select value={form.status} onChange={(v) => setForm({ ...form, status: v as Investment['status'] })}
                options={(Object.keys(INV_STATUS_KEY) as Investment['status'][]).map((s) => ({ value: s, label: t(INV_STATUS_KEY[s]) }))} />
            </div>
          )}
          <div className={editingId ? '' : 'sm:col-span-2'}>
            <label className="field-label">{t('fin_notes')}</label>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="input-field" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={save} className="btn-primary"><Plus className="h-4 w-4" />{editingId ? t('fin_save') : t('fin_create')}</button>
        </div>
      </Modal>

      {/* Suppression */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('fin_delete_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-300"><b>{deleteTarget?.ref}</b> — {deleteTarget?.designation}. {t('fin_cx_delete_desc')}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={() => { if (deleteTarget) deleteInvestment(deleteTarget.id); setDeleteTarget(null); toast(`✓ ${t('fin_toast_deleted')}`) }} className="btn-danger">
            <Trash2 className="h-4 w-4" />{t('fin_delete')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
