'use client'

// Jours fériés. Les fêtes nationales marocaines sont à date fixe et se
// pré-remplissent ; les fêtes religieuses suivent le calendrier hégirien et
// se décalent d'environ onze jours chaque année — elles se saisissent à la main.

import { useState } from 'react'
import { CalendarHeart, Plus, Sparkles, Trash2 } from 'lucide-react'
import HrPage from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { MA_FIXED_HOLIDAYS, todayISO, type Holiday } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useLanguage } from '@/lib/i18n'

export default function Page() {
  const holidays = useHrList<Holiday>('holidays')
  const { t, lang } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ date: todayISO(), name: '', nameAr: '', fixed: false })

  const year = new Date().getFullYear()

  /** Ajoute les fêtes nationales manquantes pour l'année en cours, en une seule écriture. */
  const seedFixed = () => {
    const existing = new Set(holidays.all.filter((h) => h.fixed).map((h) => h.date.slice(5)))
    const missing = MA_FIXED_HOLIDAYS.filter((h) => !existing.has(h.md))
    if (!missing.length) {
      toast(t('hr_hol_already'))
      return
    }
    holidays.replaceAll([
      ...missing.map((h, i) => ({
        id: `fix_${h.md}_${i}`,
        date: `${year}-${h.md}`,
        name: h.fr,
        nameAr: h.ar,
        fixed: true,
      })),
      ...holidays.all,
    ])
    toast(`✓ ${missing.length} ${t('hr_hol_added')}`)
  }

  const columns: HrColumn<Holiday>[] = [
    { key: 'date', label: t('hr_col_date'), value: (h) => h.date },
    { key: 'name', label: t('hr_hol_name'), value: (h) => (lang === 'ar' && h.nameAr ? h.nameAr : h.name) },
    {
      key: 'fixed', label: t('hr_hol_kind'), align: 'center',
      value: (h) => (h.fixed ? t('hr_hol_fixed') : t('hr_hol_moving')),
      render: (h) => (
        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
          h.fixed
            ? 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400'
            : 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400'
        }`}>
          {h.fixed ? t('hr_hol_fixed') : t('hr_hol_moving')}
        </span>
      ),
    },
    {
      key: 'del', label: '', meta: true, align: 'right', value: () => '',
      render: (h) => (
        <button onClick={() => holidays.remove(h.id)} className="text-gray-300 transition-colors hover:text-rose-500">
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <HrPage
      icon={CalendarHeart}
      title="hr_hol_title"
      subtitle="hr_hol_sub"
      perm="hr.planning"
      actions={
        <>
          <button onClick={seedFixed} className="btn-secondary"><Sparkles className="h-4 w-4" />{t('hr_hol_seed')}</button>
          <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t('hr_hol_new')}</button>
        </>
      }
    >
      <HrTable
        rows={holidays.items}
        columns={columns}
        search={(h) => `${h.name} ${h.nameAr ?? ''} ${h.date}`}
        filename="jours-feries"
        empty={t('hr_hol_empty')}
        defaultSort={{ key: 'date', dir: 'asc' }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t('hr_hol_new')} closeOnBackdrop={false}>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_col_date')}</span>
            <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="input-field" />
          </label>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t('hr_hol_name')} className="input-field" />
          <input value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })} placeholder={t('hr_hol_name_ar')} className="input-field" dir="rtl" />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-zinc-200">
            <input type="checkbox" checked={f.fixed} onChange={(e) => setF({ ...f, fixed: e.target.checked })} className="h-4 w-4 accent-amber-500" />
            {t('hr_hol_is_fixed')}
          </label>
          <p className="rounded-xl border border-dashed border-gray-200 p-3 text-[11px] leading-relaxed text-gray-500 dark:border-white/15 dark:text-zinc-400">
            {t('hr_hol_hint')}
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button
              onClick={() => {
                if (!f.name.trim()) return
                holidays.add({ ...f, nameAr: f.nameAr || undefined })
                setOpen(false)
                setF({ date: todayISO(), name: '', nameAr: '', fixed: false })
                toast(`✓ ${t('hr_saved')}`)
              }}
              disabled={!f.name.trim()}
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
