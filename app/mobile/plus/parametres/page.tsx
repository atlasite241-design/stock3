'use client'

import Link from 'next/link'
import { Building2, Check, Languages, Monitor, Moon, Sun } from 'lucide-react'
import MobileSubShell from '@/components/MobileSubShell'
import { useDroguerie } from '@/lib/store'
import { useTheme } from '@/lib/theme'
import { usePrimary, PRESETS } from '@/lib/primary'
import { useLanguage } from '@/lib/i18n'

export default function MobileParametresPage() {
  const { stores, activeStoreId, switchStore } = useDroguerie()
  const { theme, toggleTheme } = useTheme()
  const { primary, setPrimary } = usePrimary()
  const { t, lang, toggleLang } = useLanguage()

  return (
    <MobileSubShell title={t('mob_set_title')} subtitle={t('mob_set_subtitle')}>
      {/* Thème */}
      <section className="rounded-2xl m-card p-4 backdrop-blur-xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-400/80">{t('mob_set_theme')}</p>
        <button
          onClick={toggleTheme}
          className="flex w-full items-center justify-between rounded-xl bg-slate-100 dark:bg-white/5 px-4 py-3"
        >
          <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-900 dark:text-white">
            {theme === 'dark' ? <Moon className="h-5 w-5 text-amber-300" /> : <Sun className="h-5 w-5 text-amber-300" />}
            {theme === 'dark' ? t('mob_set_theme_dark') : t('mob_set_theme_light')}
          </span>
          <span className="relative h-6 w-11 rounded-full bg-slate-700">
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${theme === 'dark' ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </button>
      </section>

      {/* Couleur du thème */}
      <section className="rounded-2xl m-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-600/80 dark:text-amber-400/80">{t('mob_set_color')}</p>
        <div className="flex flex-wrap items-center gap-3">
          {PRESETS.map((p) => {
            const active = primary.id === p.id
            return (
              <button
                key={p.id}
                onClick={() => setPrimary({ id: p.id })}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition active:scale-90 ${active ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : ''}`}
                style={{ backgroundColor: p.swatch, boxShadow: active ? `0 0 0 2px ${p.swatch}` : 'none' }}
                aria-label={p.id}
              >
                {active && <Check className="h-5 w-5 text-white" strokeWidth={3} />}
              </button>
            )
          })}
          {/* Couleur personnalisée */}
          <label
            className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600"
            style={primary.id === 'custom' && primary.hex ? { backgroundColor: primary.hex, borderStyle: 'solid' } : undefined}
          >
            <input
              type="color"
              value={primary.hex ?? '#f59e0b'}
              onChange={(e) => setPrimary({ id: 'custom', hex: e.target.value })}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            {primary.id === 'custom' ? (
              <Check className="h-5 w-5 text-white" strokeWidth={3} />
            ) : (
              <span className="text-xs font-bold text-slate-400">+</span>
            )}
          </label>
        </div>
      </section>

      {/* Langue */}
      <section className="rounded-2xl m-card p-4 backdrop-blur-xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-400/80">{t('mob_set_lang')}</p>
        <button onClick={toggleLang} className="flex w-full items-center justify-between rounded-xl bg-slate-100 dark:bg-white/5 px-4 py-3">
          <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-900 dark:text-white">
            <Languages className="h-5 w-5 text-amber-300" />
            {lang === 'ar' ? 'العربية' : 'Français'}
          </span>
          <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300">{lang === 'ar' ? 'FR' : 'ع'}</span>
        </button>
      </section>

      {/* Magasin actif */}
      {stores.length > 0 && (
        <section className="rounded-2xl m-card p-4 backdrop-blur-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-400/80">{t('mob_set_store')}</p>
          <div className="space-y-1.5">
            {stores.map((s) => (
              <button
                key={s.id}
                onClick={() => switchStore(s.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${s.id === activeStoreId ? 'bg-amber-500/15' : 'hover:bg-slate-100 dark:bg-white/5'}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 dark:bg-white/10 text-amber-300"><Building2 className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{s.name}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{s.code}{s.city ? ` · ${s.city}` : ''}</span>
                </span>
                {s.id === activeStoreId && <Check className="h-4 w-4 shrink-0 text-amber-400" />}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Version complète */}
      <Link
        href="/"
        className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-amber-500/20 bg-slate-100 dark:bg-white/5 py-3.5 text-sm font-semibold text-amber-300 transition active:scale-[0.98]"
      >
        <Monitor className="h-5 w-5" />{t('mob_set_full')}
      </Link>
    </MobileSubShell>
  )
}
