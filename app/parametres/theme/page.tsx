'use client'

import { useRef } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Check, Moon, Palette, Pipette, Sun } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useDroguerie } from '@/lib/store'
import { useTheme } from '@/lib/theme'
import { PRESETS, usePrimary } from '@/lib/primary'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready } = useDroguerie()
  const { theme, toggleTheme } = useTheme()
  const { primary, setPrimary } = usePrimary()
  const { t } = useLanguage()
  const colorInputRef = useRef<HTMLInputElement>(null)
  const customHex = primary.id === 'custom' ? primary.hex ?? '#f59e0b' : '#8b5cf6'

  if (!ready) {
    return <Loader />
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('psub_theme_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('psub_theme_subtitle')}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card max-w-xl p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500">
            {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('psub_theme_title')}</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">{t('psub_theme_desc')}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => theme === 'dark' && toggleTheme()}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-4 text-sm font-semibold transition ${
              theme === 'light'
                ? 'border-amber-400 bg-amber-50 text-amber-700'
                : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 hover:border-amber-300'
            }`}
          >
            <Sun className="h-4 w-4" />
            {t('psub_theme_light')}
          </button>
          <button
            onClick={() => theme === 'light' && toggleTheme()}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-4 text-sm font-semibold transition ${
              theme === 'dark'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 hover:border-amber-300'
            }`}
          >
            <Moon className="h-4 w-4" />
            {t('psub_theme_dark')}
          </button>
        </div>
      </motion.div>

      {/* Primary color */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card max-w-xl p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('psub_primary_title')}</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">{t('psub_primary_desc')}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {PRESETS.map((p) => {
            const active = primary.id === p.id
            return (
              <button
                key={p.id}
                onClick={() => setPrimary({ id: p.id })}
                className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 transition hover:scale-105 ${
                  active ? 'border-gray-900 dark:border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: p.swatch }}
                title={p.id}
              >
                {active && <Check className="h-5 w-5 text-white drop-shadow" strokeWidth={3} />}
              </button>
            )
          })}

          {/* Custom color */}
          <button
            onClick={() => colorInputRef.current?.click()}
            className={`relative flex h-12 w-12 items-center justify-center rounded-xl border-2 transition hover:scale-105 ${
              primary.id === 'custom' ? 'border-gray-900 dark:border-white' : 'border-gray-200 dark:border-white/15'
            }`}
            style={primary.id === 'custom' ? { backgroundColor: customHex } : undefined}
            title={t('psub_primary_custom')}
          >
            <Pipette className={`h-5 w-5 ${primary.id === 'custom' ? 'text-white drop-shadow' : 'text-amber-500'}`} />
            <input
              ref={colorInputRef}
              type="color"
              value={customHex}
              onChange={(e) => setPrimary({ id: 'custom', hex: e.target.value })}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </button>
        </div>
      </motion.div>
    </>
  )
}

export default function ParametresThemePage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
