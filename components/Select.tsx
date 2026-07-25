'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

// Au-delà de ce nombre d'options, on affiche un champ de recherche et on limite le
// nombre d'éléments rendus : sans ça, un menu de 25 000 produits mettait plusieurs
// secondes à s'ouvrir (rendu de 25 000 boutons).
const SEARCH_THRESHOLD = 20
const RENDER_CAP = 100

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
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Normalisation mémorisée : évite de re-parcourir 25 000 options à chaque rendu.
  const normalized: SelectOption[] = useMemo(
    () => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
    [options]
  )
  const current = normalized.find((o) => o.value === value)
  const withSearch = normalized.length > SEARCH_THRESHOLD

  // Filtrage + plafond du nombre d'éléments rendus.
  const { shown, total } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out: SelectOption[] = []
    let total = 0
    for (const o of normalized) {
      if (q && !o.label.toLowerCase().includes(q)) continue
      total++
      if (out.length < RENDER_CAP) out.push(o)
    }
    return { shown: out, total }
  }, [normalized, query])

  useEffect(() => {
    if (open && withSearch) requestAnimationFrame(() => searchRef.current?.focus())
    if (!open) setQuery('')
  }, [open, withSearch])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input-field flex items-center justify-between gap-2 text-left"
      >
        <span className={`truncate ${current ? '' : 'text-gray-400 dark:text-zinc-500'}`}>
          {current?.label ?? placeholder ?? value}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform dark:text-zinc-500 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-max rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#12121a]">
          {withSearch && (
            <div className="relative p-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
                className="input-field !h-9 w-full pl-8 text-sm"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="max-h-60 overflow-y-auto">
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
              {shown.length} / {total} — précise ta recherche
            </p>
          )}
        </div>
      )}
    </div>
  )
}
