'use client'

import { useMemo, useState } from 'react'
import { Phone, Search, Truck } from 'lucide-react'
import MobileSubShell from '@/components/MobileSubShell'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function MobileFournisseursPage() {
  const { suppliers } = useDroguerie()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const list = useMemo(
    () => suppliers.filter((s) => !q || s.name.toLowerCase().includes(q) || (s.phone ?? '').includes(q)),
    [suppliers, q]
  )

  return (
    <MobileSubShell title={t('mob_sup_title')} subtitle={t('mob_sup_subtitle')}>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('mob_search')}
          className="h-11 w-full rounded-2xl border border-sky-500/20 bg-white/5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-400/60"
        />
      </div>
      <div className="space-y-3">
        {list.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.08] p-4 backdrop-blur-xl">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300"><Truck className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{s.name}</p>
              {s.phone && (
                <a href={`tel:${s.phone}`} className="flex items-center gap-1 text-xs text-slate-400"><Phone className="h-3 w-3" />{s.phone}</a>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-400">{t('mob_sup_balance')}</p>
              <p className={`text-sm font-bold tabular-nums ${s.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{fmtDH(s.balance)}</p>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-6 text-center text-sm text-slate-400">{t('mob_empty')}</p>}
      </div>
    </MobileSubShell>
  )
}
