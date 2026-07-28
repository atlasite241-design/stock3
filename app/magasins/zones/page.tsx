'use client'

import React, { useMemo, useRef, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Download, FileSpreadsheet, LayoutGrid, Pencil, Plus, Save, Sparkles, Trash2, Upload } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { depotShortCode, storeShortCode, useDroguerie, type Zone } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const d = useDroguerie()
  const { ready, zones, allees, stores, activeStore, activeStoreId, addZone, updateZone, deleteZone, seedDefaultZones, seedZoneAllees, bulkAddZones } = d
  const { t } = useLanguage()
  const toast = useToast()

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<{ code: string; name: string; type: 'commerciale' | 'logistique' }>({ code: '', name: '', type: 'commerciale' })
  const [useTemplate, setUseTemplate] = useState(true)
  const [importDepot, setImportDepot] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const storeDepots = useMemo(() => d.depots.filter((x) => x.storeId === activeStoreId), [d.depots, activeStoreId])
  const depotCodeOf = (depotId?: string) => {
    const dep = storeDepots.find((x) => x.id === depotId)
    const idx = storeDepots.findIndex((x) => x.id === depotId)
    return dep?.code || (idx >= 0 ? depotShortCode(idx) : storeDepots[0]?.code || depotShortCode(0))
  }

  // Code court du magasin actif (MAG01, MAG02…) pour l'aperçu de l'emplacement.
  const storeCode = useMemo(() => {
    const idx = stores.findIndex((s) => s.id === activeStoreId)
    return storeShortCode(idx < 0 ? 0 : idx)
  }, [stores, activeStoreId])

  if (!ready) return <Loader />

  const list = zones.filter((z) => z.storeId === activeStoreId)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.code.localeCompare(b.code, 'fr'))
  const alleeCount = (zoneId: string) => allees.filter((a) => a.zoneId === zoneId).length

  const openNew = () => { setEditId(null); setForm({ code: '', name: '', type: 'commerciale' }); setUseTemplate(true); setOpen(true) }
  const openEdit = (z: Zone) => { setEditId(z.id); setForm({ code: z.code, name: z.name, type: z.type ?? 'commerciale' }); setOpen(true) }

  const save = () => {
    const code = form.code.trim().toUpperCase()
    const name = form.name.trim()
    if (!code) return
    // Unicité du code de zone dans le magasin.
    const clash = list.some((z) => z.code.toUpperCase() === code && z.id !== editId)
    if (clash) { toast(t('wms_code_exists'), 'error'); return }
    if (editId) updateZone(editId, { code, name, type: form.type })
    else {
      const z = addZone({ storeId: activeStoreId, code, name, type: form.type, active: true, order: list.length })
      if (useTemplate) {
        const n = seedZoneAllees(z.id, activeStoreId, code)
        toast(n > 0 ? `✓ ${name} — ${n} ${t('wms_allees').toLowerCase()}` : t('mag_saved'))
        setOpen(false)
        return
      }
    }
    toast(t('mag_saved'))
    setOpen(false)
  }

  const remove = (z: Zone) => {
    const res = deleteZone(z.id)
    if (!res.ok) { toast(t('wms_has_children'), 'error'); return }
    toast(t('mag_delete'))
  }

  const toggleActive = (z: Zone) => updateZone(z.id, { active: z.active === false })

  // Réorganiser : échange l'ordre avec le voisin.
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= list.length) return
    const a = list[idx], b = list[j]
    updateZone(a.id, { order: b.order ?? j })
    updateZone(b.id, { order: a.order ?? idx })
  }

  const seedZones = () => {
    const n = seedDefaultZones(activeStoreId)
    toast(n > 0 ? `✓ ${n} ${t('wms_zone_default_added')}` : t('wms_zone_default_none'))
  }

  // ---- Export / Import des zones (avec dépôt) ----
  const exportRows = (): (string | number)[][] => [
    ['Code', 'Nom', 'Type', 'Depot'],
    ...list.map((z) => [z.code, z.name || '', z.type === 'logistique' ? 'logistique' : 'commerciale', depotCodeOf(z.depotId)]),
  ]
  const exportCsv = () => {
    const csv = exportRows().map((r) => r.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `zones-${activeStore?.name || ''}.csv`.replace(/[^\w.-]+/g, '_'); a.click(); URL.revokeObjectURL(url)
  }
  const exportXlsx = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet(exportRows())
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Zones'); XLSX.writeFile(wb, `zones-${activeStore?.name || ''}.xlsx`.replace(/[^\w.-]+/g, '_'))
  }
  const applyImport = (rows: (string | number)[][]) => {
    const parsed = rows.filter((r) => r && r.length >= 1).map((r) => ({
      code: String(r[0] ?? ''), name: r[1] != null ? String(r[1]) : undefined,
      type: /logist/i.test(String(r[2] ?? '')) ? ('logistique' as const) : ('commerciale' as const),
    }))
    const depotId = importDepot || storeDepots[0]?.id
    const n = bulkAddZones(activeStoreId, depotId, parsed)
    toast(n > 0 ? `✓ ${n} ${t('wms_zone_default_added')}` : t('wms_import_none'), n > 0 ? 'success' : 'error')
  }
  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const isExcel = /\.xlsx?$/i.test(file.name) || /sheet|excel/i.test(file.type)
    const reader = new FileReader()
    if (isExcel) {
      reader.onload = async () => {
        try {
          const XLSX = await import('xlsx')
          const wb = XLSX.read(new Uint8Array(reader.result as ArrayBuffer), { type: 'array' })
          applyImport(XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false }))
        } catch { toast(t('wms_import_none'), 'error') }
      }
      reader.readAsArrayBuffer(file)
    } else {
      reader.onload = () => applyImport(String(reader.result).replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(/[;,\t]/)))
      reader.readAsText(file)
    }
    e.target.value = ''
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <LayoutGrid className="h-6 w-6 text-amber-500" />
            {t('wms_zones_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('wms_zones_subtitle')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
            <span className="ml-1 font-mono text-xs text-gray-400 dark:text-zinc-500">({storeCode})</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {storeDepots.length > 1 && (
            <div className="w-40"><Select value={importDepot || storeDepots[0]?.id} onChange={setImportDepot} options={storeDepots.map((x, i) => ({ value: x.id, label: `${x.code || depotShortCode(i)} · ${x.name}` }))} /></div>
          )}
          <button onClick={() => fileRef.current?.click()} className="btn-secondary"><Upload className="h-4 w-4" />{t('wms_import')}</button>
          <button onClick={exportCsv} disabled={list.length === 0} className="btn-secondary disabled:opacity-40"><Download className="h-4 w-4" />CSV</button>
          <button onClick={exportXlsx} disabled={list.length === 0} className="btn-secondary disabled:opacity-40"><FileSpreadsheet className="h-4 w-4" />Excel</button>
          <button onClick={seedZones} className="btn-secondary"><Sparkles className="h-4 w-4" />{t('wms_zone_default')}</button>
          <button onClick={openNew} className="btn-primary"><Plus className="h-4 w-4" />{t('wms_zone_new')}</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onImport} className="hidden" />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card overflow-hidden">
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <LayoutGrid className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('wms_zone_none')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  <th className="px-5 py-3">{t('wms_code')}</th>
                  <th className="px-5 py-3">{t('wms_zone_name')}</th>
                  <th className="px-5 py-3">{t('wms_zone_type')}</th>
                  <th className="px-5 py-3">{t('wms_emplacement')}</th>
                  <th className="px-5 py-3 text-center">{t('wms_allees')}</th>
                  <th className="px-5 py-3 text-center">{t('wms_zone_state')}</th>
                  <th className="px-5 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((z, idx) => {
                  const inactive = z.active === false
                  return (
                  <tr key={z.id} className={`border-b border-gray-50 last:border-0 dark:border-white/5 hover:bg-amber-50/40 dark:hover:bg-white/5 ${inactive ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 font-mono text-sm font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{z.code}</span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{z.name || '—'}</td>
                    <td className="px-5 py-3">
                      {z.type === 'logistique'
                        ? <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">{t('wms_zone_logistic')}</span>
                        : <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">{t('wms_zone_commercial')}</span>}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-zinc-400">{storeCode}-{depotCodeOf(z.depotId)}-{z.code}</td>
                    <td className="px-5 py-3 text-center tabular-nums text-gray-600 dark:text-zinc-300">{alleeCount(z.id)}</td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => toggleActive(z)} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${inactive ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-zinc-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'}`}>
                        {inactive ? t('wms_zone_inactive') : t('wms_zone_active')}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => move(idx, -1)} disabled={idx === 0} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-white/10"><ChevronUp className="h-4 w-4" /></button>
                        <button onClick={() => move(idx, 1)} disabled={idx === list.length - 1} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-white/10"><ChevronDown className="h-4 w-4" /></button>
                        <button onClick={() => openEdit(z)} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-amber-400">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(z)} className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? t('wms_zone_edit') : t('wms_zone_new')} maxWidth="max-w-sm">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('wms_code')}</span>
            <input className="input-field font-mono uppercase" value={form.code} maxLength={4} placeholder="A" onChange={(e) => setForm({ ...form, code: e.target.value })} autoFocus />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('wms_zone_name')}</span>
            <input className="input-field" value={form.name} placeholder={t('wms_zone_name_ph')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('wms_zone_type')}</span>
            <div className="flex gap-2">
              {(['commerciale', 'logistique'] as const).map((tp) => (
                <button key={tp} type="button" onClick={() => setForm({ ...form, type: tp })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${form.type === tp ? 'border-amber-400 bg-amber-500 text-white' : 'border-gray-200 text-gray-600 dark:border-white/10 dark:text-zinc-300'}`}>
                  {tp === 'logistique' ? t('wms_zone_logistic') : t('wms_zone_commercial')}
                </button>
              ))}
            </div>
          </label>
          {!editId && (
            <div className="space-y-2 rounded-xl border border-gray-100 p-3 dark:border-white/10">
              <span className="block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('wms_tpl_title')}</span>
              <button type="button" onClick={() => setUseTemplate(true)} className={`flex w-full items-start gap-2 rounded-lg border p-2.5 text-left transition ${useTemplate ? 'border-amber-400 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10' : 'border-gray-200 dark:border-white/10'}`}>
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${useTemplate ? 'border-amber-500 bg-amber-500' : 'border-gray-300'}`}>{useTemplate && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span>
                <span><span className="block text-sm font-semibold text-gray-800 dark:text-zinc-100">{t('wms_tpl_use')}</span><span className="block text-[11px] text-gray-500 dark:text-zinc-400">{t('wms_tpl_use_desc')}</span></span>
              </button>
              <button type="button" onClick={() => setUseTemplate(false)} className={`flex w-full items-start gap-2 rounded-lg border p-2.5 text-left transition ${!useTemplate ? 'border-amber-400 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10' : 'border-gray-200 dark:border-white/10'}`}>
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${!useTemplate ? 'border-amber-500 bg-amber-500' : 'border-gray-300'}`}>{!useTemplate && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span>
                <span><span className="block text-sm font-semibold text-gray-800 dark:text-zinc-100">{t('wms_tpl_empty')}</span><span className="block text-[11px] text-gray-500 dark:text-zinc-400">{t('wms_tpl_empty_desc')}</span></span>
              </button>
            </div>
          )}
          {form.code.trim() && (
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              {t('wms_emplacement')} : <span className="font-mono text-amber-600 dark:text-amber-400">{storeCode}-{form.code.trim().toUpperCase()}</span>
            </p>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
          <button onClick={save} disabled={!form.code.trim()} className="btn-primary disabled:opacity-50">
            <Save className="h-4 w-4" />
            {t('mag_save')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function ZonesPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
