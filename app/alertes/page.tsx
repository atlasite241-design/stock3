'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { AlertTriangle, Clock, CreditCard, FileWarning, PackageX, ShieldAlert, Truck } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { creditStatus, daysLate, fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, clients, suppliers, purchases, credits } = useDroguerie()
  const { t } = useLanguage()

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const now = new Date()
  const soon = new Date()
  soon.setDate(now.getDate() + 7)

  const outOfStock = products.filter((p) => p.stock === 0)
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.minStock)
  const debtSuppliers = suppliers.filter((s) => s.balance > 0)
  const pendingOrders = purchases.filter((p) => p.status === 'en_attente')
  const unpaidInvoices = purchases.filter((p) => p.status === 'recue' && p.paid < p.total)

  const openCredits = credits.filter((c) => c.amount - c.paid > 0.001)
  const creditsOverdue = openCredits.filter((c) => creditStatus(c, now) === 'retard')
  const creditsDueSoon = openCredits.filter((c) => {
    const due = new Date(c.dueDate)
    return due >= now && due <= soon
  })
  const overLimitClients = clients.filter((c) => c.creditLimit > 0 && c.credit > c.creditLimit)

  const totalAlerts =
    outOfStock.length + lowStock.length + creditsOverdue.length + creditsDueSoon.length + overLimitClients.length + pendingOrders.length + unpaidInvoices.length

  const sections = [
    {
      title: t('al_out_of_stock'),
      icon: PackageX,
      cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400',
      count: outOfStock.length,
      href: '/stock',
      rows: outOfStock.map((p) => ({ label: p.name, value: t('al_status_rupture'), danger: true })),
    },
    {
      title: t('al_low_stock'),
      icon: AlertTriangle,
      cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500',
      count: lowStock.length,
      href: '/stock',
      rows: lowStock.map((p) => ({ label: p.name, value: `${p.stock} / ${t('al_min_abbr')} ${p.minStock}`, danger: false })),
    },
    {
      title: t('al_pending_orders'),
      icon: Clock,
      cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400',
      count: pendingOrders.length,
      href: '/achats?tab=en_attente',
      rows: pendingOrders.map((p) => ({ label: `${p.ref} — ${p.supplierName}`, value: fmtDH(p.total), danger: false })),
    },
    {
      title: t('al_unpaid_invoices'),
      icon: FileWarning,
      cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400',
      count: unpaidInvoices.length,
      href: '/achats?tab=factures',
      rows: unpaidInvoices.map((p) => ({ label: `${p.ref} — ${p.supplierName}`, value: fmtDH(p.total - p.paid), danger: true })),
    },
    {
      title: t('al_credits_overdue'),
      icon: CreditCard,
      cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400',
      count: creditsOverdue.length,
      href: '/clients/credits',
      rows: creditsOverdue.map((c) => ({ label: `${c.ref} — ${c.clientName}`, value: `${fmtDH(c.amount - c.paid)} · ${daysLate(c, now)}${t('al_days_late_suffix')}`, danger: true })),
    },
    {
      title: t('al_credits_due_soon'),
      icon: Clock,
      cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500',
      count: creditsDueSoon.length,
      href: '/clients/credits',
      rows: creditsDueSoon.map((c) => ({ label: `${c.ref} — ${c.clientName}`, value: `${fmtDH(c.amount - c.paid)} · ${new Date(c.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`, danger: false })),
    },
    {
      title: t('al_credits_overlimit'),
      icon: ShieldAlert,
      cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400',
      count: overLimitClients.length,
      href: '/clients/credits',
      rows: overLimitClients.map((c) => ({ label: c.name, value: `${fmtDH(c.credit)} / ${fmtDH(c.creditLimit)}`, danger: true })),
    },
    {
      title: t('al_supplier_debts'),
      icon: Truck,
      cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400',
      count: debtSuppliers.length,
      href: '/fournisseurs',
      rows: debtSuppliers.map((s) => ({ label: s.name, value: fmtDH(s.balance), danger: true })),
    },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('al_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          {totalAlerts === 0
            ? t('al_all_clear')
            : `${totalAlerts} ${t('al_points_attention')}`}
        </p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.4 }}
            className="glass-card flex flex-col p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.cls}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{s.title}</h2>
              </div>
              <span
                className={`rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${
                  s.count > 0 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {s.count}
              </span>
            </div>

            <div className="mt-4 flex-1 space-y-1.5">
              {s.rows.slice(0, 5).map((r, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50/60 dark:bg-white/5 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-zinc-300">{r.label}</span>
                  <span className={`shrink-0 text-xs font-bold tabular-nums ${r.danger ? 'text-rose-500 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {r.value}
                  </span>
                </div>
              ))}
              {s.rows.length === 0 && (
                <p className="py-4 text-center text-xs text-emerald-600 dark:text-emerald-400">{t('al_nothing_to_report')}</p>
              )}
              {s.rows.length > 5 && (
                <p className="pt-1 text-center text-xs text-gray-400 dark:text-zinc-500">+ {s.rows.length - 5} {t('al_others_suffix')}</p>
              )}
            </div>

            <Link
              href={s.href}
              className="mt-4 block rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 py-2 text-center text-xs font-bold text-gray-700 dark:text-zinc-300 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
            >
              {t('al_manage')}
            </Link>
          </motion.div>
        ))}
      </div>
    </>
  )
}

export default function AlertesPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
