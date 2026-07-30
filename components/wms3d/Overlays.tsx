'use client'

// Overlays DOM de l'explorateur 3D : fil d'Ariane, recherche, mini-carte,
// panneau de détail d'une position et légende des états. Style glassmorphism
// sombre, animations Framer Motion.

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Barcode, ChevronRight, Home, MapPin, Package, Search, X } from 'lucide-react'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'
import type { Layout } from './layout'
import { STATUS_COLOR, type PosNode, type PosStatus, type Sel, type WmsTree } from './types'

/* ------------------------------ Breadcrumb -------------------------------- */

export function Breadcrumb({ tree, sel, onNavigate }: {
  tree: WmsTree
  sel: Sel
  onNavigate: (sel: Sel) => void
}) {
  const { t } = useLanguage()
  const zone = tree.zones.find((z) => z.id === sel.zone)
  const allee = zone?.allees.find((a) => a.id === sel.allee)
  const rayon = allee?.rayons.find((r) => r.id === sel.rayon)
  const etagere = rayon?.etageres.find((e) => e.id === sel.etagere)
  const niveau = etagere?.niveaux.find((n) => n.id === sel.niveau)

  const crumbs: { label: string; sel: Sel }[] = [{ label: t('x3_home'), sel: {} }]
  if (zone) crumbs.push({ label: `${t('wms_zone')} ${zone.code}${zone.name ? ' · ' + zone.name : ''}`, sel: { zone: zone.id } })
  if (zone && allee) crumbs.push({ label: `${t('wms_allee')} ${allee.code}`, sel: { zone: zone.id, allee: allee.id } })
  if (zone && allee && rayon) crumbs.push({ label: `${t('wms_rayon')} ${rayon.code}`, sel: { zone: zone.id, allee: allee.id, rayon: rayon.id } })
  if (zone && allee && rayon && etagere) crumbs.push({ label: `${t('wms_etagere')} ${etagere.code}`, sel: { zone: zone.id, allee: allee.id, rayon: rayon.id, etagere: etagere.id } })
  if (zone && allee && rayon && etagere && niveau) crumbs.push({ label: `${t('wms_niveau')} ${niveau.code}`, sel: { ...crumbs[crumbs.length - 1].sel, niveau: niveau.id } })

  return (
    <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-black/50 px-2.5 py-1.5 backdrop-blur-xl">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-zinc-500" />}
            <button
              onClick={() => onNavigate(c.sel)}
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold transition ${last ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-300 hover:bg-white/10 hover:text-white'}`}
            >
              {i === 0 ? <span className="flex items-center gap-1"><Home className="h-3 w-3" />{c.label}</span> : c.label}
            </button>
          </span>
        )
      })}
    </div>
  )
}

/* ------------------------------- SearchBar -------------------------------- */

export function SearchBar({ onSearch }: { onSearch: (q: string) => boolean }) {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [err, setErr] = useState(false)

  const go = () => {
    if (!q.trim()) return
    const ok = onSearch(q)
    setErr(!ok)
    if (ok) setQ('')
  }

  return (
    <div className="pointer-events-auto">
      <div className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 backdrop-blur-xl transition ${err ? 'border-rose-500/60 bg-rose-950/40' : 'border-white/10 bg-black/50'}`}>
        <Search className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setErr(false) }}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          placeholder={t('x3_search_ph')}
          className="w-44 bg-transparent font-mono text-[11px] text-white placeholder:text-zinc-500 focus:outline-none sm:w-56"
        />
        <button onClick={go} className="rounded-md bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-white transition hover:bg-amber-500">OK</button>
      </div>
      {err && <p className="mt-1 text-[10px] font-semibold text-rose-400">{t('x3_not_found')}</p>}
    </div>
  )
}

/* -------------------------------- MiniMap --------------------------------- */

export function MiniMap({ tree, layout, sel, onJump }: {
  tree: WmsTree
  layout: Layout
  sel: Sel
  onJump: (zoneId: string) => void
}) {
  const w = layout.world
  const pad = 1.5
  const vb = `${w.x - pad} ${w.z - pad} ${w.w + pad * 2} ${w.d + pad * 2}`
  const focus = useMemo(() => {
    if (sel.niveau && layout.niveaux.has(sel.niveau)) { const p = layout.niveaux.get(sel.niveau)!; return { x: p.x + p.w / 2, z: p.z + p.d / 2 } }
    if (sel.etagere && layout.etageres.has(sel.etagere)) { const b = layout.etageres.get(sel.etagere)!; return { x: b.x + b.w / 2, z: b.z + b.d / 2 } }
    if (sel.rayon && layout.rayons.has(sel.rayon)) { const b = layout.rayons.get(sel.rayon)!; return { x: b.x + b.w / 2, z: b.z + b.d / 2 } }
    if (sel.allee && layout.allees.has(sel.allee)) { const b = layout.allees.get(sel.allee)!; return { x: b.x + b.w / 2, z: b.z + b.d / 2 } }
    return null
  }, [sel, layout])

  return (
    <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/50 p-2 backdrop-blur-xl">
      <svg viewBox={vb} className="h-24 w-36 sm:h-28 sm:w-44" preserveAspectRatio="xMidYMid meet">
        {tree.zones.map((z) => {
          const r = layout.zones.get(z.id)
          if (!r) return null
          const active = sel.zone === z.id
          return (
            <g key={z.id} onClick={() => onJump(z.id)} className="cursor-pointer">
              <rect x={r.x} y={r.z} width={r.w} height={r.d} rx={0.6}
                fill={z.color} fillOpacity={active ? 0.75 : 0.35}
                stroke={active ? '#fbbf24' : 'rgba(255,255,255,0.25)'} strokeWidth={active ? 0.35 : 0.15} />
              <text x={r.x + r.w / 2} y={r.z + r.d / 2} textAnchor="middle" dominantBaseline="central"
                fill="#fff" fontSize={Math.min(r.w, r.d) * 0.38} fontWeight={700}>{z.code}</text>
            </g>
          )
        })}
        {sel.allee && layout.allees.has(sel.allee) && (() => {
          const b = layout.allees.get(sel.allee)!
          return <rect x={b.x} y={b.z - 0.2} width={b.w} height={b.d + 0.4} fill="none" stroke="#fbbf24" strokeWidth={0.28} rx={0.3} />
        })()}
        {focus && (
          <circle cx={focus.x} cy={focus.z} r={0.55} fill="#fbbf24">
            <animate attributeName="r" values="0.4;0.8;0.4" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
    </div>
  )
}

/* --------------------------------- Legend --------------------------------- */

const ST_KEYS: PosStatus[] = ['empty', 'ok', 'low', 'out', 'reserved', 'off']

export function Legend({ tree }: { tree: WmsTree }) {
  const { t } = useLanguage()
  const counts = useMemo(() => {
    const c: Record<PosStatus, number> = { empty: 0, ok: 0, low: 0, out: 0, reserved: 0, off: 0 }
    for (const f of tree.flat) c[f.node.status]++
    return c
  }, [tree])
  // Une ligne quand la largeur le permet, sinon repli sur 3 puis 2 colonnes.
  // `w-fit` + `whitespace-nowrap` garantissent qu'aucun libellé n'est tronqué.
  return (
    <div className="pointer-events-auto grid w-fit max-w-full grid-cols-2 gap-x-3 gap-y-1 rounded-xl border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-xl sm:grid-cols-3 xl:grid-cols-6">
      {ST_KEYS.map((k) => (
        <span key={k} className="flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold text-zinc-300">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: STATUS_COLOR[k] }} />
          {t(`x3_st_${k}` as Parameters<typeof t>[0])}
          <span className="ml-auto tabular-nums text-zinc-500">{counts[k].toLocaleString('fr-FR')}</span>
        </span>
      ))}
    </div>
  )
}

/* ------------------------------ DetailPanel ------------------------------- */

const IN_TYPES = new Set(['entree', 'reception', 'reappro', 'transfert_in', 'retour', 'stock_initial'])
const OUT_TYPES = new Set(['vente', 'sortie', 'transfert_out'])

export function DetailPanel({ pos, onClose }: { pos: PosNode | null; onClose: () => void }) {
  const { t, lang } = useLanguage()
  const { movements } = useDroguerie()

  const dates = useMemo(() => {
    if (!pos?.productId) return { lastIn: null as string | null, lastOut: null as string | null }
    let lastIn: string | null = null, lastOut: string | null = null
    for (const m of movements) {
      if (m.productId !== pos.productId) continue
      if (IN_TYPES.has(m.type) && (!lastIn || m.date > lastIn)) lastIn = m.date
      if (OUT_TYPES.has(m.type) && (!lastOut || m.date > lastOut)) lastOut = m.date
    }
    return { lastIn, lastOut }
  }, [pos, movements])

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR') : '—')

  return (
    <AnimatePresence>
      {pos && (
        <motion.aside
          initial={{ x: 340, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 340, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="pointer-events-auto absolute inset-y-3 right-3 z-20 w-72 overflow-y-auto rounded-2xl border border-white/10 bg-black/60 p-4 shadow-2xl backdrop-blur-2xl"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white"><MapPin className="h-4 w-4 text-amber-400" />{t('x3_panel_title')}</h3>
            <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
          </div>

          <div className="mt-3 rounded-xl bg-white/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{t('x3_panel_emplacement')}</p>
            <p className="mt-1 break-all font-mono text-xs font-bold text-amber-300">{pos.full}</p>
          </div>

          <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/5 p-3">
            <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: STATUS_COLOR[pos.status] }} />
            <span className="text-xs font-semibold text-white">{t(`x3_st_${pos.status}` as Parameters<typeof t>[0])}</span>
          </div>

          <div className="mt-2 rounded-xl bg-white/5 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500"><Package className="h-3 w-3" />{t('x3_product')}</p>
            <p className="mt-1 text-sm font-semibold text-white">{pos.productName ?? t('x3_empty_pos')}</p>
            {pos.barcode && (
              <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-zinc-400"><Barcode className="h-3 w-3" />{pos.barcode}</p>
            )}
          </div>

          {pos.productName && (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/5 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{t('x3_stock')}</p>
                  <p className={`mt-0.5 text-xl font-extrabold tabular-nums ${pos.stock <= 0 ? 'text-rose-400' : pos.stock <= pos.minStock ? 'text-amber-400' : 'text-emerald-400'}`}>{pos.stock}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{t('x3_stock_min')}</p>
                  <p className="mt-0.5 text-xl font-extrabold tabular-nums text-zinc-300">{pos.minStock}</p>
                </div>
              </div>
              <div className="mt-2 space-y-1.5 rounded-xl bg-white/5 p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-zinc-500">{t('x3_last_in')}</span>
                  <span className="font-mono text-emerald-300">{fmt(dates.lastIn)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-zinc-500">{t('x3_last_out')}</span>
                  <span className="font-mono text-rose-300">{fmt(dates.lastOut)}</span>
                </div>
              </div>
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
