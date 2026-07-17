'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

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
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const normalized: SelectOption[] = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  )
  const current = normalized.find((o) => o.value === value)

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
        <div className="absolute z-50 mt-1.5 max-h-64 w-full min-w-max overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#12121a]">
          {normalized.map((o) => (
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
          {normalized.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400 dark:text-zinc-500">Aucune option</p>
          )}
        </div>
      )}
    </div>
  )
}
