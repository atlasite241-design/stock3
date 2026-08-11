'use client'

// Budgets OPEX : une enveloppe par catégorie de charge et par exercice.
// Le consommé n'est jamais saisi : il se déduit des dépenses IMPUTÉES au
// budget (champ « Budget » du formulaire de dépense). Alertes à 80 % (avertissement),
// 100 % (atteint) et au-delà (dépassement).

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { usePermissions } from '@/lib/access'
import {
  BUDGET_STATUS_META,
  budgetAlert,
  budgetConsumed,
  EXPENSE_CATEGORIES,
  fmtDH,
  useDroguerie,
  type Budget,
} from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const BUDGET_STATUS_KEY: Record<Budget['status'], TKey> = {
  brouillon: 'fin_st_brouillon',
  soumis: 'fin_st_soumis',
  valide: 'fin_st_valide',
  en_cours: 'fin_st_en_cours',
  cloture: 'fin_st_cloture',
}

const NEXT_STATUS: Record<Budget['status'], Budget['status']> = {
  brouillon: 'soumis', soumis: 'valide', valide: 'en_cours', en_cours: 'cloture', cloture: 'cloture',
}

const ALERT_CHIP: Record<ReturnType<typeof budgetAlert>, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  reached: 'text-orange-600 dark:text-orange-400',
  over: 'text-rose-600 dark:text-rose-400',
}

const EMPTY = { category: EXPENSE_CATEGORIES[0], subcategory: '', planned: '', responsable: '', notes: '', startDate: '', endDate: '' }

function Content() {
  const { ready, budgets, expenses, users, activeStore, addBudget, updateBudget, advanceBudget, deleteBudget } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()

  const nowYear = new Date().getFullYear()
  const [year, setYear] = useState(String(nowYear))
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null)

  const rows = useMemo(
    () =>
      budgets
        .filter((b) => b.year === Number(year))
        .map((b) => {
          const consumed = budgetConsumed(b, expenses)
          const pct = b.planned > 0 ? (consumed / b.planned) * 100 : 0
          return { b, consumed, remaining: b.planned - consumed, pct, alert: budgetAlert(b.planned, consumed) }
        })
        .sort((a, z) => z.pct - a.pct),
    [budgets, expenses, year]
  )

  const totals = useMemo(() => {
    let planned = 0, consumed = 0
    for (const r of rows) { planned += r.b.planned; consumed += r.consumed }
    return { planned, consumed, remaining: planned - consumed, pct: planned > 0 ? (consumed / planned) * 100 : 0 }
  }, [rows])

  if (!ready) return <Loader />

  const years = Array.from(new Set([nowYear, nowYear + 1, ...budgets.map((b) => b.year)])).sort()

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setModalOpen(true) }
  const openEdit = (b: Budget) => {
    setEditingId(b.id)
    setForm({
      category: b.category, subcategory: b.subcategory ?? '', planned: String(b.planned),
      responsable: b.responsable ?? '', notes: b.notes ?? '', startDate: b.startDate, endDate: b.endDate,
    })
    setModalOpen(true)
  }

  const save = () => {
    const planned = parseFloat(form.planned.replace(',', '.')) || 0
    if (planned <= 0) { toast(t('fin_toast_amount'), 'error'); return }
    if (editingId) {
      updateBudget(editingId, {
        category: form.category, subcategory: form.subcategory.trim() || undefined, planned,
        responsable: form.responsable || undefined, notes: form.notes.trim() || undefined,
        ...(form.startDate ? { startDate: form.startDate } : {}), ...(form.endDate ? { endDate: form.endDate } : {}),
      })
      toast(`✓ ${t('fin_toast_updated')}`)
    } else {
      const r = addBudget({
        year: Number(year), category: form.category, subcategory: form.subcategory.trim() || undefined,
        planned, responsable: form.responsable || undefined, notes: form.notes.trim() || undefined,
        startDate: form.startDate || undefined, endDate: form.endDate || undefined,
      })
      if ('error' in r) { toast(t('fin_toast_dates'), 'error'); return }
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
            <Wallet className="h-6 w-6 text-amber-500" />
            {t('fin_opex_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('fin_opex_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={year} onChange={setYear} options={years.map((y) => ({ value: String(y), label: `${t('fin_exercice')} ${y}` }))} className="w-40" />
          {can('fin.budget_create') && (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="h-4 w-4" />
              {t('fin_new_budget')}
            </button>
          )}
        </div>
      </motion.div>

      {/* Totaux de l'exercice */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { v: fmtDH(totals.planned), l: t('fin_kpi_planned'), c: 'text-gray-900 dark:text-white' },
          { v: fmtDH(totals.consumed), l: t('fin_kpi_consumed'), c: 'text-amber-600 dark:text-amber-400' },
          { v: fmtDH(totals.remaining), l: t('fin_kpi_remaining'), c: totals.remaining < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400' },
          { v: `${Math.round(totals.pct)} %`, l: t('fin_kpi_rate'), c: ALERT_CHIP[budgetAlert(totals.planned, totals.consumed)] },
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
            <Wallet className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('fin_opex_empty')}</p>
          </div>
        ) : (
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                <th className="px-4 py-3">{t('fin_col_ref')}</th>
                <th className="px-4 py-3">{t('fin_col_category')}</th>
                <th className="px-4 py-3 text-right">{t('fin_col_planned')}</th>
                <th className="px-4 py-3 text-right">{t('fin_col_consumed')}</th>
                <th className="px-4 py-3 text-right">{t('fin_col_remaining')}</th>
                <th className="px-4 py-3">{t('fin_col_progress')}</th>
                <th className="px-4 py-3">{t('fin_col_responsable')}</th>
                <th className="px-4 py-3">{t('fin_col_status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ b, consumed, remaining, pct, alert }) => (
                <tr key={b.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2.5 font-semibold text-amber-600 dark:text-amber-400">{b.ref}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-gray-900 dark:text-white">{b.category}</span>
                    {b.subcategory && <span className="ml-1 text-xs text-gray-400">· {b.subcategory}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-zinc-300">{fmtDH(b.planned)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-white">{fmtDH(consumed)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${remaining < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmtDH(remaining)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                        <div
                          className={`h-full rounded-full ${alert === 'over' ? 'bg-rose-500' : alert === 'reached' ? 'bg-orange-500' : alert === 'warning' ? 'bg-amber-400' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold tabular-nums ${ALERT_CHIP[alert]}`}>{Math.round(pct)} %</span>
                      {alert !== 'ok' && <AlertTriangle className={`h-3.5 w-3.5 ${ALERT_CHIP[alert]}`} />}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{b.responsable ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${BUDGET_STATUS_META[b.status].chip}`}>
                      {t(BUDGET_STATUS_KEY[b.status])}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      {b.status !== 'cloture' &&
                        // Soumettre un brouillon demande fin.budget_edit ; passer à
                        // valide/en_cours/cloture demande fin.budget_validate.
                        (b.status === 'brouillon' ? can('fin.budget_edit') : can('fin.budget_validate')) && (
                        <button onClick={() => advanceBudget(b.id)} className="btn-secondary !px-2.5 !py-1 text-[11px]" title={t('fin_advance_hint')}>
                          → {t(BUDGET_STATUS_KEY[NEXT_STATUS[b.status]])}
                        </button>
                      )}
                      {can('fin.budget_edit') && (
                        <button onClick={() => openEdit(b)} className="btn-secondary !px-2 !py-1"><Pencil className="h-3.5 w-3.5" /></button>
                      )}
                      {b.status === 'brouillon' && can('fin.budget_delete') && (
                        <button onClick={() => setDeleteTarget(b)} className="btn-secondary !px-2 !py-1 !text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Création / édition */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('fin_edit_budget') : t('fin_new_budget')} maxWidth="max-w-md">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label">{t('fin_col_category')}</label>
            <Select value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={[...EXPENSE_CATEGORIES]} />
          </div>
          <div>
            <label className="field-label">{t('fin_subcategory')}</label>
            <input value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="field-label">{t('fin_col_planned')} (DH)</label>
            <input value={form.planned} onChange={(e) => setForm({ ...form, planned: e.target.value })} inputMode="decimal" className="input-field tabular-nums" autoFocus />
          </div>
          <div>
            <label className="field-label">{t('fin_col_responsable')}</label>
            <Select value={form.responsable} onChange={(v) => setForm({ ...form, responsable: v })}
              options={[{ value: '', label: '—' }, ...users.filter((u) => u.active).map((u) => ({ value: u.name, label: u.name }))]} />
          </div>
          <div>
            <label className="field-label">{t('fin_start')}</label>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="field-label">{t('fin_end')}</label>
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input-field" />
          </div>
        </div>
        <div className="mt-4">
          <label className="field-label">{t('fin_notes')}</label>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field" />
        </div>
        <p className="mt-2 text-[11px] text-gray-400 dark:text-zinc-500">{t('fin_dates_hint')} {year}.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={save} className="btn-primary"><Plus className="h-4 w-4" />{editingId ? t('fin_save') : t('fin_create')}</button>
        </div>
      </Modal>

      {/* Suppression (brouillon uniquement) */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('fin_delete_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-300">
          <b>{deleteTarget?.ref}</b> — {deleteTarget?.category}. {t('fin_delete_desc')}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={() => { if (deleteTarget) deleteBudget(deleteTarget.id); setDeleteTarget(null); toast(`✓ ${t('fin_toast_deleted')}`) }} className="btn-danger">
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
