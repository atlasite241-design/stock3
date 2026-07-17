'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Award, Gift, Save, Sparkles, Star } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, clients, loyaltyMovements, settings, saveSettings, redeemPoints } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [pointsPerAmount, setPointsPerAmount] = useState(String(settings.pointsPerAmount))
  const [pointValueDH, setPointValueDH] = useState(String(settings.pointValueDH))
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [redeemClientId, setRedeemClientId] = useState('')
  const [redeemAmount, setRedeemAmount] = useState('')

  const ledger = useMemo(() => {
    const map = new Map<string, { gained: number; used: number }>()
    loyaltyMovements.forEach((m) => {
      const e = map.get(m.clientId) ?? { gained: 0, used: 0 }
      if (m.type === 'gain') e.gained += m.points
      else e.used += m.points
      map.set(m.clientId, e)
    })
    return map
  }, [loyaltyMovements])

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const totalPoints = clients.reduce((a, c) => a + c.points, 0)
  const totalDiscountAvailable = clients.reduce((a, c) => a + c.discountBalance, 0)
  const redeemClient = clients.find((c) => c.id === redeemClientId)
  const redeemPointsNum = Math.max(0, Math.round(parseFloat(redeemAmount.replace(',', '.')) || 0))
  const redeemValue = redeemPointsNum * settings.pointValueDH

  const saveLoyaltySettings = () => {
    const ppa = Math.max(1, parseFloat(pointsPerAmount.replace(',', '.')) || settings.pointsPerAmount)
    const pv = Math.max(0.01, parseFloat(pointValueDH.replace(',', '.')) || settings.pointValueDH)
    saveSettings({ ...settings, pointsPerAmount: ppa, pointValueDH: pv })
    toast(`✓ ${t('loy_toast_saved')}`)
  }

  const submitRedeem = () => {
    if (!redeemClient) {
      toast(t('loy_toast_choose_client'), 'error')
      return
    }
    if (redeemPointsNum <= 0 || redeemPointsNum > redeemClient.points) {
      toast(t('loy_toast_invalid_points'), 'error')
      return
    }
    redeemPoints(redeemClient.id, redeemPointsNum)
    toast(`✓ ${redeemPointsNum} ${t('loy_toast_converted_prefix')} ${fmtDH(redeemValue)} ${t('loy_toast_converted_suffix')} ${redeemClient.name}`)
    setRedeemOpen(false)
    setRedeemClientId('')
    setRedeemAmount('')
  }

  const cards = [
    { label: t('loy_kpi_circulating'), value: String(totalPoints), icon: Star, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('loy_kpi_available_discounts'), value: fmtDH(totalDiscountAvailable), icon: Gift, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
    { label: t('loy_kpi_loyal_clients'), value: String(clients.filter((c) => c.points > 0).length), icon: Award, cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400' },
  ]

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('loy_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('loy_subtitle')}</p>
        </div>
        <button onClick={() => setRedeemOpen(true)} className="btn-primary">
          <Sparkles className="h-4 w-4" />
          {t('loy_convert')}
        </button>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.4 }}
            className="glass-card glass-card-hover p-5"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.cls}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{c.label}</p>
            <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
              {c.value}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Clients ledger */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="glass-card overflow-hidden xl:col-span-2"
        >
          <div className="border-b border-gray-100 px-5 py-4 dark:border-white/10">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('loy_balance_title')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  <th className="px-5 py-3">{t('loy_col_client')}</th>
                  <th className="px-5 py-3">{t('loy_col_earned')}</th>
                  <th className="px-5 py-3">{t('loy_col_used')}</th>
                  <th className="px-5 py-3">{t('loy_col_balance')}</th>
                  <th className="px-5 py-3">{t('loy_col_discount_available')}</th>
                </tr>
              </thead>
              <tbody>
                {clients
                  .filter((c) => c.points > 0 || c.discountBalance > 0)
                  .sort((a, b) => b.points - a.points)
                  .map((c) => {
                    const l = ledger.get(c.id) ?? { gained: c.points, used: 0 }
                    return (
                      <tr key={c.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                        <td className="px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white">{c.name}</td>
                        <td className="px-5 py-3 text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">+{l.gained}</td>
                        <td className="px-5 py-3 text-sm text-rose-500 dark:text-rose-400 tabular-nums">
                          {l.used > 0 ? `-${l.used}` : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <span className="rounded-lg bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                            ⭐ {c.points}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold text-gray-700 dark:text-zinc-300 tabular-nums">
                          {c.discountBalance > 0 ? fmtDH(c.discountBalance) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                {clients.filter((c) => c.points > 0 || c.discountBalance > 0).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                      {t('loy_none_yet')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Settings */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="glass-card p-5"
        >
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('loy_program_settings')}</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="field-label">{t('loy_point_per_amount')}</label>
              <input
                type="number"
                min="1"
                value={pointsPerAmount}
                onChange={(e) => setPointsPerAmount(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="field-label">{t('loy_point_value')}</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={pointValueDH}
                onChange={(e) => setPointValueDH(e.target.value)}
                className="input-field"
              />
            </div>
            <button onClick={saveLoyaltySettings} className="btn-primary w-full">
              <Save className="h-4 w-4" />
              {t('loy_save')}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Movements history */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('loy_movements_history')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3">{t('loy_col_date')}</th>
                <th className="px-5 py-3">{t('loy_col_client')}</th>
                <th className="px-5 py-3">{t('loy_col_type')}</th>
                <th className="px-5 py-3">{t('loy_col_note')}</th>
                <th className="px-5 py-3 text-right">{t('loy_col_points')}</th>
              </tr>
            </thead>
            <tbody>
              {loyaltyMovements.slice(0, 30).map((m) => (
                <tr key={m.id} className="border-b border-gray-50 dark:border-white/5">
                  <td className="px-5 py-3 text-sm text-gray-600 dark:text-zinc-400">
                    {new Date(m.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white">{m.clientName}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-lg border px-2 py-1 text-xs font-bold ${
                        m.type === 'gain'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-400'
                      }`}
                    >
                      {m.type === 'gain' ? t('loy_type_gain') : t('loy_type_use')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 dark:text-zinc-400">{m.note}</td>
                  <td className={`px-5 py-3 text-right text-sm font-bold tabular-nums ${m.type === 'gain' ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-600 dark:text-violet-400'}`}>
                    {m.type === 'gain' ? '+' : '−'}
                    {m.points}
                  </td>
                </tr>
              ))}
              {loyaltyMovements.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('loy_none_movement')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Redeem modal */}
      <Modal open={redeemOpen} onClose={() => setRedeemOpen(false)} title={t('loy_redeem_title')} maxWidth="max-w-sm">
        <div className="space-y-4">
          <div>
            <label className="field-label">{t('loy_client_label')}</label>
            <Select
              value={redeemClientId}
              onChange={setRedeemClientId}
              placeholder={t('loy_choose')}
              options={[
                { value: '', label: t('loy_choose') },
                ...clients.filter((c) => c.points > 0).map((c) => ({ value: c.id, label: `${c.name} (${c.points} ${t('loy_points_abbr')})` })),
              ]}
            />
          </div>
          <div>
            <label className="field-label">{t('loy_points_to_convert')}</label>
            <input
              type="number"
              min="1"
              max={redeemClient?.points ?? undefined}
              value={redeemAmount}
              onChange={(e) => setRedeemAmount(e.target.value)}
              className="input-field"
            />
            {redeemClient && (
              <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                = {fmtDH(redeemValue)} {t('loy_equals_discount')} {redeemClient.points} {t('loy_pts_suffix')}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={() => setRedeemOpen(false)} className="btn-secondary">
              {t('loy_cancel')}
            </button>
            <button onClick={submitRedeem} className="btn-primary">
              <Gift className="h-4 w-4" />
              {t('loy_convert_btn')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default function FidelitePage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
