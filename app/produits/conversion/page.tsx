'use client'

// Conversion des fiches « lot » en fiches « pièce + conditionnement ».
//
// L'opération multiplie le stock par le facteur détecté. Elle est donc
// présentée ligne par ligne, décochée par défaut sur ce qui mérite un regard,
// avec une sauvegarde avant application et un contrôle de valeur après.

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Boxes, Play, Search, TriangleAlert } from 'lucide-react'
import AppShell from '@/components/AppShell'
import DangerConfirm from '@/components/DangerConfirm'
import Loader from '@/components/Loader'
import { useToast } from '@/components/Toast'
import { appliquer, planifierConversions, type Conversion } from '@/lib/conversion-lots'
import { createBackup, fmtDH, uid, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const PAGE = 60

function Content() {
  const { ready, products, applyLotConversions } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [plan, setPlan] = useState<Conversion[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState<{ converties: number; valeurAvant: number; valeurApres: number } | null>(null)

  if (!ready) return <Loader />

  const run = () => {
    setBusy(true)
    setTimeout(() => {
      try {
        const p = planifierConversions(products)
        setPlan(p)
        // Tout est coché : la détection exige déjà un mot-clé explicite.
        // C'est le décochage qui devient l'acte de vigilance.
        setPicked(new Set(p.map((c) => c.id)))
        setShown(PAGE)
        setDone(null)
      } finally {
        setBusy(false)
      }
    }, 30)
  }

  const rows = (plan ?? []).filter((c) => {
    const q = query.trim().toLowerCase()
    return !q || c.nomActuel.toLowerCase().includes(q)
  })

  const selection = (plan ?? []).filter((c) => picked.has(c.id))
  const valeurSelection = selection.reduce((s, c) => s + c.valeurAvant, 0)

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const apply = () => {
    try { createBackup(`Avant conversion en conditionnements — ${new Date().toLocaleString('fr-FR')}`) } catch {}
    const r = applyLotConversions(
      selection.map((c) => ({ id: c.id, apply: (p: typeof products[number]) => appliquer(p, c, uid()) }))
    )
    setConfirm(false)
    setDone(r)
    setPlan(null)
    setPicked(new Set())
    toast(`✓ ${r.converties.toLocaleString('fr-FR')} ${t('cv_done')}`)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Boxes className="h-6 w-6 text-amber-500" />{t('cv_title')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">{t('cv_sub')}</p>
        </div>
        <button onClick={run} disabled={busy} className="btn-primary disabled:opacity-40">
          <Play className="h-4 w-4" />{busy ? t('dv_running') : t('cv_run')}
        </button>
      </motion.div>

      {done && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <p className="font-bold text-emerald-800 dark:text-emerald-300">
            {done.converties.toLocaleString('fr-FR')} {t('cv_done')}
          </p>
          <p className="mt-1 tabular-nums text-emerald-700 dark:text-emerald-400">
            {t('cv_value_before')} {fmtDH(done.valeurAvant)} → {t('cv_value_after')} {fmtDH(done.valeurApres)}
            {Math.abs(done.valeurAvant - done.valeurApres) < 1
              ? <span className="ml-1 font-bold">✓ {t('cv_value_ok')}</span>
              : <span className="ml-1 font-bold text-rose-600 dark:text-rose-400">✗ {t('cv_value_ko')}</span>}
          </p>
        </div>
      )}

      {!plan && !busy && (
        <div className="glass-card p-8">
          <p className="mx-auto max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-zinc-300">{t('cv_intro')}</p>
          <div className="mx-auto mt-4 max-w-3xl overflow-x-auto rounded-xl bg-gray-50 p-3 text-xs dark:bg-white/5">
            <table className="w-full min-w-[520px]">
              <tbody className="text-gray-600 dark:text-zinc-300">
                <tr><td className="py-1 pr-4 font-semibold">{t('cv_ex_before')}</td><td className="font-mono">Cheville Ingco 100 pcs · 64 × 57,38 DH</td></tr>
                <tr><td className="py-1 pr-4 font-semibold">{t('cv_ex_after')}</td><td className="font-mono">Cheville Ingco · 6 400 pièces × 0,5738 DH</td></tr>
                <tr><td className="py-1 pr-4 font-semibold">{t('cv_ex_unit')}</td><td className="font-mono">Boîte de 100 ×100 → 95,00 DH</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mx-auto mt-4 max-w-3xl text-xs leading-relaxed text-gray-500 dark:text-zinc-400">{t('cv_safety')}</p>
        </div>
      )}

      {busy && <Loader />}

      {plan && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { l: t('cv_kpi_found'), v: plan.length.toLocaleString('fr-FR') },
              { l: t('cv_kpi_picked'), v: selection.length.toLocaleString('fr-FR'), tone: 'text-amber-600 dark:text-amber-400' },
              { l: t('cv_kpi_value'), v: fmtDH(valeurSelection) },
              { l: t('cv_kpi_untouched'), v: (products.length - plan.length).toLocaleString('fr-FR'), tone: 'text-gray-400 dark:text-zinc-500' },
            ].map((c, i) => (
              <div key={i} className="glass-card p-4">
                <p className={`text-2xl font-extrabold tabular-nums ${c.tone ?? 'text-gray-900 dark:text-white'}`}>{c.v}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{c.l}</p>
              </div>
            ))}
          </div>

          {plan.length === 0 ? (
            <p className="glass-card p-12 text-center text-sm text-emerald-600 dark:text-emerald-400">{t('cv_none')}</p>
          ) : (
            <>
              <div className="glass-card flex flex-wrap items-center gap-3 p-3">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 rtl:left-auto rtl:right-3" />
                  <input value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE) }}
                    placeholder={t('hr_search')} className="input-field pl-9 rtl:pl-3 rtl:pr-9" />
                </div>
                <button onClick={() => setPicked(new Set(plan.map((c) => c.id)))} className="btn-secondary">{t('dp_select_all')}</button>
                <button onClick={() => setPicked(new Set())} className="btn-secondary">{t('dp_unselect_all')}</button>
                <button onClick={() => setConfirm(true)} disabled={selection.length === 0} className="btn-primary disabled:opacity-40">
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />{t('cv_apply')} · {selection.length.toLocaleString('fr-FR')}
                </button>
              </div>

              <div className="glass-card overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                      <th className="w-8 px-3 py-3" />
                      <th className="px-3 py-3">{t('cv_col_current')}</th>
                      <th className="px-3 py-3">{t('cv_col_new')}</th>
                      <th className="px-3 py-3">{t('cv_col_unit')}</th>
                      <th className="px-3 py-3 text-right">{t('cv_col_stock')}</th>
                      <th className="px-3 py-3 text-right">{t('cv_col_cost')}</th>
                      <th className="px-3 py-3 text-right">{t('cv_col_price')}</th>
                      <th className="px-3 py-3 text-right">{t('ec_col_value')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, shown).map((c) => {
                      const ecart = Math.abs(c.valeurApres - c.valeurAvant) > 0.01
                      return (
                        <tr key={c.id} className={`border-b border-gray-50 last:border-0 dark:border-white/5 ${picked.has(c.id) ? '' : 'opacity-45'}`}>
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-amber-500" />
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-zinc-400">{c.nomActuel}</td>
                          <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">{c.nomPropose}</td>
                          <td className="px-3 py-2">
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                              {c.conditionnement} ×{c.facteur}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <span className="text-gray-400">{c.stockAvant.toLocaleString('fr-FR')}</span>
                            <span className="mx-1 text-gray-300">→</span>
                            <b className="text-gray-900 dark:text-white">{c.stockApres.toLocaleString('fr-FR')}</b>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <span className="text-gray-400">{c.coutAvant}</span>
                            <span className="mx-1 text-gray-300">→</span>
                            <b className="text-gray-900 dark:text-white">{c.coutApres}</b>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <span className="text-gray-400">{c.prixAvant}</span>
                            <span className="mx-1 text-gray-300">→</span>
                            <b className="text-gray-900 dark:text-white">{c.prixApres}</b>
                          </td>
                          <td className={`px-3 py-2 text-right tabular-nums font-semibold ${ecart ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {fmtDH(c.valeurAvant)}
                            {ecart && <span className="ml-1">≠ {fmtDH(c.valeurApres)}</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {rows.length > shown && (
                <div className="flex justify-center">
                  <button onClick={() => setShown((n) => n + PAGE * 3)} className="btn-secondary">
                    {shown.toLocaleString('fr-FR')} / {rows.length.toLocaleString('fr-FR')} — {t('rpst_more')}
                  </button>
                </div>
              )}

              <p className="flex items-start gap-2 rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-3 text-[11px] leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/[0.06] dark:text-amber-300">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{t('cv_warn')}
              </p>
            </>
          )}
        </>
      )}

      <DangerConfirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={apply}
        title={t('cv_confirm_title')}
        description={<>{selection.length.toLocaleString('fr-FR')} {t('cv_confirm_desc')}</>}
        actionLabel={t('cv_apply')}
      />
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
