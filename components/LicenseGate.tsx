'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { activateLicense, isLicensed } from '@/lib/license'
import { useLanguage } from '@/lib/i18n'

/**
 * Porte d'activation : après connexion, bloque l'accès tant qu'une clé de
 * licence valide n'a pas été saisie. La clé est consommée (supprimée) côté
 * Turso et l'activation est mémorisée localement (par appareil).
 */
export default function LicenseGate({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage()
  const [checked, setChecked] = useState(false)
  const [licensed, setLicensed] = useState(false)
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLicensed(isLicensed())
    setChecked(true)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim() || loading) return
    setLoading(true)
    setError('')
    const res = await activateLicense(key)
    setLoading(false)
    if (res.ok) {
      setLicensed(true)
    } else {
      setError(res.error === 'network' ? t('lic_network') : res.error === 'unconfigured' ? t('lic_unconfigured') : t('lic_invalid'))
    }
  }

  // Évite tout flash tant que localStorage n'est pas lu.
  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-400 dark:bg-[#0a0a0f] dark:text-zinc-500">…</div>
    )
  }

  if (licensed) return <>{children}</>

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-50 px-4 dark:bg-[#0a0a0f]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-500/10 blur-[120px]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md rounded-3xl border border-gray-200 bg-white/80 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-900 shadow-lg">
            <KeyRound className="h-7 w-7" />
          </span>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('lic_title')}</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">{t('lic_subtitle')}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder={t('lic_placeholder')}
            autoFocus
            spellCheck={false}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center font-mono text-sm tracking-widest text-gray-900 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          {error && <p className="text-center text-sm font-semibold text-rose-500">{error}</p>}
          <button
            type="submit"
            disabled={loading || !key.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3 text-sm font-bold text-slate-900 shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {loading ? t('lic_activating') : t('lic_activate')}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-gray-400 dark:text-zinc-500">{t('lic_hint')}</p>
      </motion.div>
    </div>
  )
}
