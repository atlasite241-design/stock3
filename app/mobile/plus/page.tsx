'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeftRight,
  Bell,
  ChevronRight,
  LogOut,
  MessageCircle,
  Package,
  PackageCheck,
  PackagePlus,
  Settings,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'
import MobileShell from '@/components/MobileShell'
import { useDroguerie } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { useLanguage, type TKey } from '@/lib/i18n'

type Item = { href: string; icon: React.ReactNode; labelKey: TKey; badge?: number; tone?: string }
type Section = { titleKey: TKey; items: Item[] }

function Content() {
  const { t } = useLanguage()
  const { products } = useDroguerie()
  const { logout } = useAuth()
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)

  const lowCount = products.filter((p) => p.stock <= p.minStock).length

  const sections: Section[] = [
    {
      titleKey: 'mob_sec_sales',
      items: [
        { href: '/mobile/plus/produits', icon: <Package className="h-5 w-5" />, labelKey: 'mob_m_products' },
        { href: '/mobile/plus/clients', icon: <Users className="h-5 w-5" />, labelKey: 'mob_m_clients' },
        { href: '/mobile/plus/factures-whatsapp', icon: <MessageCircle className="h-5 w-5" />, labelKey: 'mob_m_invoices_wa', tone: 'text-emerald-600 bg-emerald-500/15 dark:text-emerald-300' },
      ],
    },
    {
      titleKey: 'mob_sec_stock',
      items: [
        { href: '/mobile/plus/fournisseurs', icon: <Truck className="h-5 w-5" />, labelKey: 'mob_m_suppliers' },
        { href: '/mobile/plus/stock-critique', icon: <TriangleAlert className="h-5 w-5" />, labelKey: 'mob_m_critical', badge: lowCount, tone: 'text-rose-600 bg-rose-500/15 dark:text-rose-300' },
        { href: '/mobile/plus/reappro', icon: <PackagePlus className="h-5 w-5" />, labelKey: 'mob_m_restock' },
        { href: '/mobile/plus/reception', icon: <PackageCheck className="h-5 w-5" />, labelKey: 'mob_m_reception' },
        { href: '/mobile/plus/transferts', icon: <ArrowLeftRight className="h-5 w-5" />, labelKey: 'mob_m_transfers' },
      ],
    },
    {
      titleKey: 'mob_sec_register',
      items: [{ href: '/mobile/plus/caisse', icon: <Wallet className="h-5 w-5" />, labelKey: 'mob_m_register' }],
    },
    {
      titleKey: 'mob_sec_system',
      items: [
        { href: '/mobile/plus/notifications', icon: <Bell className="h-5 w-5" />, labelKey: 'mob_m_notifications', badge: lowCount, tone: 'text-amber-600 bg-amber-500/15 dark:text-amber-300' },
        { href: '/mobile/plus/parametres', icon: <Settings className="h-5 w-5" />, labelKey: 'mob_m_settings' },
      ],
    },
  ]

  const doLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <>
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('mob_more_title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('mob_more_subtitle')}</p>
      </motion.section>

      {sections.map((section) => (
        <section key={section.titleKey} className="space-y-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-widest text-sky-600/80 dark:text-sky-400/70">{t(section.titleKey)}</h2>
          <div className="overflow-hidden rounded-2xl m-card">
            {section.items.map((it, i) => (
              <Link
                key={it.href}
                href={it.href}
                className={`flex items-center gap-3.5 px-4 py-3.5 transition active:bg-sky-500/10 ${i > 0 ? 'border-t border-slate-100 dark:border-white/5' : ''}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${it.tone ?? 'bg-sky-500/15 text-sky-600 dark:text-sky-300'}`}>
                  {it.icon}
                </span>
                <span className="flex-1 text-[15px] font-semibold text-slate-900 dark:text-white">{t(it.labelKey)}</span>
                {it.badge ? (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">{it.badge}</span>
                ) : null}
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* Déconnexion */}
      <section className="pt-1">
        {!confirm ? (
          <button
            onClick={() => setConfirm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 py-3.5 text-[15px] font-semibold text-rose-600 dark:text-rose-300 transition active:scale-[0.98]"
          >
            <LogOut className="h-5 w-5" />
            {t('mob_m_logout')}
          </button>
        ) : (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
            <p className="mb-3 text-center text-sm font-semibold text-slate-900 dark:text-white">{t('mob_m_logout_confirm')}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirm(false)} className="rounded-xl bg-slate-200 dark:bg-white/10 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 transition active:scale-95">
                {t('mob_cancel')}
              </button>
              <button onClick={doLogout} className="rounded-xl bg-rose-500 py-2.5 text-sm font-bold text-white transition active:scale-95">
                {t('mob_m_logout')}
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  )
}

export default function MobilePlusPage() {
  return (
    <MobileShell>
      <Content />
    </MobileShell>
  )
}
