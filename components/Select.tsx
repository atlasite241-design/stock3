'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

// Au-delà de ce nombre d'options, on affiche un champ de recherche et on limite le
// nombre d'éléments rendus : sans ça, un menu de 25 000 produits mettait plusieurs
// secondes à s'ouvrir (rendu de 25 000 boutons).
const SEARCH_THRESHOLD = 20
const RENDER_CAP = 100 // premier lot affiché ; le défilement en charge davantage

export default function Select({
  value,
  onChange,
  options,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  options: (SelectOption | string)[]
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cap, setCap] = useState(RENDER_CAP)
  const [pos, setPos] = useState<{ left: number; top: number; width: number; flip: boolean } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Ferme au clic hors du bouton ET hors du panneau (le panneau est dans un portail,
  // donc pas contenu dans `ref`).
  useEffect(() => {
    // Phase de CAPTURE : garantit la fermeture même si un parent stoppe la
    // propagation (ex. contenu d'une modale).
    const onDown = (e: Event) => {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  // Position du panneau (portail) : calculée sous le bouton, rabattue vers le haut
  // s'il n'y a pas la place en bas. Recalculée à l'ouverture, au défilement, au resize.
  const place = () => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const flip = spaceBelow < 280 && r.top > spaceBelow
    setPos({ left: r.left, top: flip ? r.top : r.bottom, width: r.width, flip })
  }
  useLayoutEffect(() => {
    if (!open) return
    place()
    const onScroll = () => place()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const normalized: SelectOption[] = useMemo(
    () => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
    [options]
  )
  const current = normalized.find((o) => o.value === value)
  const withSearch = normalized.length > SEARCH_THRESHOLD

  const { shown, total } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out: SelectOption[] = []
    let total = 0
    for (const o of normalized) {
      if (q && !o.label.toLowerCase().includes(q)) continue
      total++
      if (out.length < cap) out.push(o)
    }
    return { shown: out, total }
  }, [normalized, query, cap])

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) setCap((c) => c + RENDER_CAP)
  }

  useEffect(() => {
    if (open && withSearch) requestAnimationFrame(() => searchRef.current?.focus())
    if (!open) { setQuery(''); setCap(RENDER_CAP) }
  }, [open, withSearch])

  useEffect(() => { setCap(RENDER_CAP) }, [query])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input-field flex w-full items-center justify-between gap-2 text-left"
      >
        <span className={`truncate ${current ? '' : 'text-gray-400 dark:text-zinc-500'}`}>
          {current?.label ?? placeholder ?? value}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform dark:text-zinc-500 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && pos && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              left: pos.left,
              // Largeur mini = le bouton, mais le menu s'élargit pour afficher le
              // texte complet (ex. « Conforme ») sans dépasser le bord de l'écran.
              minWidth: pos.width,
              maxWidth: Math.max(pos.width, window.innerWidth - pos.left - 12),
              ...(pos.flip
                ? { bottom: window.innerHeight - pos.top + 6 }
                : { top: pos.top + 6 }),
            }}
            className="z-[200] rounded-xl border border-gray-200 bg-white p-1 shadow-2xl dark:border-white/10 dark:bg-[#12121a]"
          >
            {withSearch && (
              <div className="relative p-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher…"
                  className="input-field !h-9 w-full pl-8 text-sm"
                />
              </div>
            )}
            <div className="max-h-60 overflow-y-auto" onScroll={onScroll}>
              {shown.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    o.value === value
                      ? 'bg-amber-50 font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === value && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))}
              {shown.length === 0 && (
                <p className="px-3 py-2 text-sm text-gray-400 dark:text-zinc-500">Aucune option</p>
              )}
            </div>
            {total > shown.length && (
              <p className="px-3 py-1.5 text-center text-[11px] text-gray-400 dark:text-zinc-500">
                {shown.length} / {total} — défile ou recherche
              </p>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
