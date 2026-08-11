'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Barcode, Boxes, Building2, Check, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, ExternalLink,
  ListChecks, MapPin, Package, Percent, Printer, Rocket, Save, SkipForward, Sparkles, Store, Truck, Users, UserPlus,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { useDroguerie, storeShortCode, type Settings } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'
import { SETUP_STEPS, isStepDone, doneCount, type SetupCtx } from '@/lib/setup'

const ICONS: Record<string, typeof Store> = {
  Building2, Percent, Printer, Store, Users, CreditCard, Truck, UserPlus, Package, Barcode, MapPin, Boxes, ListChecks, Save,
}
const PAYMENT_MODES = [
  { key: 'espece', fr: 'Espèces', ar: 'نقدًا' },
  { key: 'carte', fr: 'Carte bancaire', ar: 'بطاقة بنكية' },
  { key: 'cheque', fr: 'Chèque', ar: 'شيك' },
  { key: 'virement', fr: 'Virement', ar: 'تحويل' },
  { key: 'credit', fr: 'Crédit client', ar: 'دين العميل' },
  { key: 'mobile', fr: 'Paiement mobile', ar: 'دفع عبر الهاتف' },
]
const ROLES = ['Administrateur', 'Gérant', 'Comptable', 'Acheteur', 'Magasinier', 'Caissier', 'Vendeur'] as const

function Content() {
  const d = useDroguerie()
  const { t, lang, toggleLang } = useLanguage()
  const setLang = (target: 'fr' | 'ar') => { if (lang !== target) toggleLang() }
  const L = lang as 'fr' | 'ar'
  const toast = useToast()
  const router = useRouter()
  const { settings, saveSettings } = d

  const ctx: SetupCtx = useMemo(() => ({
    settings,
    storesCount: d.stores.length,
    usersCount: d.users.length,
    suppliersCount: d.suppliers.length,
    clientsCount: d.clients.length,
    productsCount: d.products.length,
    barcodedCount: d.products.filter((p) => p.barcode).length,
    zonesCount: d.zones.length,
    stockInitDone: d.movements.some((m) => m.type === 'stock_initial'),
  }), [settings, d.stores, d.users, d.suppliers, d.clients, d.products, d.zones, d.movements])

  const total = SETUP_STEPS.length
  const done = doneCount(ctx)
  const pct = Math.round((done / total) * 100)
  const step = Math.min(settings.setup?.step ?? 0, total - 1)
  const current = SETUP_STEPS[step]
  const currentDone = isStepDone(current.key, ctx)

  // ---- Persistance de l'état de l'assistant ----
  const patchSetup = (patch: Partial<NonNullable<Settings['setup']>>) =>
    saveSettings({ ...settings, setup: { ...settings.setup, ...patch } })
  const markDone = (k: string) =>
    patchSetup({ done: Array.from(new Set([...(settings.setup?.done ?? []), k])) })
  const goStep = (i: number) => patchSetup({ step: Math.max(0, Math.min(total - 1, i)) })
  const finish = () => { patchSetup({ completed: true, step: total - 1 }); toast(`🎉 ${t('sw_done_toast')}`); router.push('/') }

  // ---- Formulaire société / fiscal ----
  const [f, setF] = useState<Settings>(settings)
  const setField = <K extends keyof Settings>(k: K, v: Settings[K]) => setF((p) => ({ ...p, [k]: v }))
  const saveForm = (keys: (keyof Settings)[], doneKey?: string) => {
    const patch: Partial<Settings> = {}
    keys.forEach((k) => { (patch as Record<string, unknown>)[k as string] = f[k] })
    saveSettings({ ...settings, ...patch, ...(doneKey ? { setup: { ...settings.setup, done: Array.from(new Set([...(settings.setup?.done ?? []), doneKey])) } } : {}) })
    toast(`✓ ${t('sw_saved')}`)
  }

  // ---- Étapes: création rapide ----
  const [storeName, setStoreName] = useState('')
  const [depotName, setDepotName] = useState('')
  const createStore = () => {
    const name = storeName.trim(); if (!name) return
    const s = d.addStore({ name, code: name.slice(0, 3).toUpperCase() || 'MAG' })
    d.switchStore(s.id); setStoreName(''); toast(`✓ ${name}`)
  }
  const createDepot = () => {
    const name = depotName.trim(); if (!name || !d.activeStoreId) return
    d.addDepot({ storeId: d.activeStoreId, name, address: '', responsable: '' }); setDepotName(''); toast(`✓ ${name}`)
  }
  const quickUser = (role: (typeof ROLES)[number]) => {
    d.addUser({ name: role, phone: '', role, active: true })
    toast(`✓ ${role}`)
  }

  const paymentModes = f.paymentModes ?? settings.paymentModes ?? ['espece']
  const togglePay = (k: string) => {
    const next = paymentModes.includes(k) ? paymentModes.filter((x) => x !== k) : [...paymentModes, k]
    setField('paymentModes', next)
    saveSettings({ ...settings, paymentModes: next })
  }

  // Impression d'un test simple (matériel).
  const testPrint = () => {
    const w = window.open('', '_blank', 'width=400,height=300')
    if (!w) return
    w.document.write(`<pre style="font-family:monospace;font-size:14px;padding:20px">${settings.storeName || 'AtlasStock'}\n\n*** TEST IMPRESSION ***\n${new Date().toLocaleString('fr-FR')}\n\nABCDEFG 0123456789\n</pre>`)
    w.document.close(); w.focus(); w.print(); setTimeout(() => w.close(), 500)
  }

  const launch = (href: string) => router.push(href)

  // ---------- Rendu de l'étape active ----------
  const stepBody = () => {
    switch (current.key) {
      case 'societe':
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('sw_f_name')}><input className="input-field" value={f.storeName} onChange={(e) => setField('storeName', e.target.value)} /></Field>
            <Field label={t('sw_f_activity')}><input className="input-field" value={f.activity ?? ''} onChange={(e) => setField('activity', e.target.value)} placeholder="Droguerie / Quincaillerie" /></Field>
            <Field label={t('sw_f_address')}><input className="input-field" value={f.address} onChange={(e) => setField('address', e.target.value)} /></Field>
            <Field label={t('sw_f_city')}><input className="input-field" value={f.city ?? ''} onChange={(e) => setField('city', e.target.value)} /></Field>
            <Field label={t('sw_f_country')}><input className="input-field" value={f.country ?? 'Maroc'} onChange={(e) => setField('country', e.target.value)} /></Field>
            <Field label={t('sw_f_phone')}><input className="input-field" value={f.phone} onChange={(e) => setField('phone', e.target.value)} /></Field>
            <Field label={t('sw_f_email')}><input className="input-field" value={f.email ?? ''} onChange={(e) => setField('email', e.target.value)} /></Field>
            <Field label={t('sw_f_web')}><input className="input-field" value={f.website ?? ''} onChange={(e) => setField('website', e.target.value)} placeholder="www.exemple.ma" /></Field>
            <Field label="ICE"><input className="input-field" value={f.ice} onChange={(e) => setField('ice', e.target.value)} /></Field>
            <Field label="IF"><input className="input-field" value={f.idFiscal} onChange={(e) => setField('idFiscal', e.target.value)} /></Field>
            <Field label="RC"><input className="input-field" value={f.rcNo} onChange={(e) => setField('rcNo', e.target.value)} /></Field>
            <Field label={t('sw_f_patente')}><input className="input-field" value={f.taxePro} onChange={(e) => setField('taxePro', e.target.value)} /></Field>
            <Field label={t('sw_f_currency')}><input className="input-field" value={f.currency} onChange={(e) => setField('currency', e.target.value)} /></Field>
            <Field label={t('sw_f_timezone')}><input className="input-field" value={f.timezone ?? 'Africa/Casablanca'} onChange={(e) => setField('timezone', e.target.value)} /></Field>
            <Field label={t('sw_f_lang')}>
              <div className="flex gap-2">
                <button onClick={() => setLang('fr')} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${lang === 'fr' ? 'border-amber-400 bg-amber-500 text-white' : 'border-gray-200 dark:border-white/10'}`}>Français</button>
                <button onClick={() => setLang('ar')} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${lang === 'ar' ? 'border-amber-400 bg-amber-500 text-white' : 'border-gray-200 dark:border-white/10'}`}>العربية</button>
              </div>
            </Field>
            <div className="sm:col-span-2"><button onClick={() => saveForm(['storeName', 'activity', 'address', 'city', 'country', 'phone', 'email', 'website', 'ice', 'idFiscal', 'rcNo', 'taxePro', 'currency', 'timezone'])} className="btn-primary"><Save className="h-4 w-4" />{t('sw_save')}</button></div>
          </div>
        )
      case 'fiscal':
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('sw_f_tva')}>
              <Select value={String(f.tva)} onChange={(v) => setField('tva', Number(v))} options={[0, 7, 10, 14, 20].map((n) => ({ value: String(n), label: `${n} %` }))} />
            </Field>
            <Field label={t('sw_f_rounding')}>
              <Select value={f.roundingMode ?? '0.01'} onChange={(v) => setField('roundingMode', v as Settings['roundingMode'])} options={[{ value: '0.01', label: '0,01' }, { value: '0.05', label: '0,05' }, { value: '0.10', label: '0,10' }, { value: '1', label: '1,00' }]} />
            </Field>
            <Field label={t('sw_f_prefix')}><input className="input-field" value={f.invoicePrefix} onChange={(e) => setField('invoicePrefix', e.target.value)} placeholder="FAC-" /></Field>
            <Field label={t('sw_f_start')}><input type="number" className="input-field" value={f.invoiceStartNumber} onChange={(e) => setField('invoiceStartNumber', Number(e.target.value))} /></Field>
            <div className="sm:col-span-2 flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />{t('sw_httc_auto')}
            </div>
            <div className="sm:col-span-2"><button onClick={() => saveForm(['tva', 'roundingMode', 'invoicePrefix', 'invoiceStartNumber'], 'fiscal')} className="btn-primary"><Save className="h-4 w-4" />{t('sw_save')}</button></div>
          </div>
        )
      case 'materiel':
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('sw_f_printformat')}>
                <Select value={f.printFormat} onChange={(v) => setField('printFormat', v as Settings['printFormat'])} options={[{ value: 'ticket58', label: 'Ticket 58 mm' }, { value: 'ticket80', label: 'Ticket 80 mm' }, { value: 'a4', label: 'A4' }]} />
              </Field>
              <Field label={t('sw_f_label')}>
                <div className="flex gap-2">
                  <input type="number" className="input-field" value={f.labelWidthMm ?? 40} onChange={(e) => setField('labelWidthMm', Number(e.target.value))} placeholder="L" />
                  <input type="number" className="input-field" value={f.labelHeightMm ?? 30} onChange={(e) => setField('labelHeightMm', Number(e.target.value))} placeholder="H" />
                </div>
              </Field>
            </div>
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('sw_hw_hint')}</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={testPrint} className="btn-secondary"><Printer className="h-4 w-4" />{t('sw_test_print')}</button>
              <button onClick={() => { saveForm(['printFormat', 'labelWidthMm', 'labelHeightMm'], 'materiel') }} className="btn-primary"><Check className="h-4 w-4" />{t('sw_validate_step')}</button>
            </div>
          </div>
        )
      case 'magasins':
        return (
          <div className="space-y-4">
            {d.stores.length > 0 && (
              <div className="rounded-xl border border-gray-100 p-3 dark:border-white/10">
                <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-zinc-400">{t('sw_active_store')}</p>
                <Select value={d.activeStoreId} onChange={d.switchStore} options={d.stores.map((s, i) => ({ value: s.id, label: `${s.name} (${storeShortCode(i)})` }))} />
                <ul className="mt-3 space-y-1 text-sm">
                  {d.depots.filter((x) => x.storeId === d.activeStoreId).map((x) => <li key={x.id} className="flex items-center gap-2 text-gray-600 dark:text-zinc-300"><Store className="h-3.5 w-3.5 text-amber-500" />{x.name}</li>)}
                </ul>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-2">
                <input className="input-field" placeholder={t('sw_new_store')} value={storeName} onChange={(e) => setStoreName(e.target.value)} />
                <button onClick={createStore} className="btn-primary shrink-0">+</button>
              </div>
              <div className="flex gap-2">
                <input className="input-field" placeholder={t('sw_new_depot')} value={depotName} onChange={(e) => setDepotName(e.target.value)} disabled={!d.activeStoreId} />
                <button onClick={createDepot} className="btn-secondary shrink-0" disabled={!d.activeStoreId}>+</button>
              </div>
            </div>
            <LaunchLink onClick={() => launch('/magasins')} label={t('sw_open_stores')} />
          </div>
        )
      case 'utilisateurs':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('sw_users_hint')}</p>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => {
                const exists = d.users.some((u) => u.role === r)
                return (
                  <button key={r} onClick={() => quickUser(r)} disabled={exists}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition ${exists ? 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-gray-200 hover:border-amber-300 dark:border-white/10'}`}>
                    {exists ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{r}
                  </button>
                )
              })}
            </div>
            <LaunchLink onClick={() => launch('/utilisateurs/employes')} label={t('sw_open_users')} />
          </div>
        )
      case 'paiement':
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('sw_pay_hint')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PAYMENT_MODES.map((m) => {
                const on = paymentModes.includes(m.key)
                return (
                  <button key={m.key} onClick={() => togglePay(m.key)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${on ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400' : 'border-gray-200 text-gray-600 dark:border-white/10 dark:text-zinc-300'}`}>
                    {m[L]}{on && <Check className="h-4 w-4" />}
                  </button>
                )
              })}
            </div>
          </div>
        )
      case 'fournisseurs':
        return <LauncherStep icon={Truck} count={ctx.suppliersCount} unit={t('sw_suppliers')} desc={t('sw_suppliers_desc')} href="/fournisseurs" launch={launch} optional onSkip={() => markDone('fournisseurs')} skipLabel={t('sw_skip')} openLabel={t('sw_open')} countLabel={t('sw_created')} />
      case 'clients':
        return <LauncherStep icon={UserPlus} count={ctx.clientsCount} unit={t('sw_clients')} desc={t('sw_clients_desc')} href="/clients" launch={launch} optional onSkip={() => markDone('clients')} skipLabel={t('sw_skip')} openLabel={t('sw_open')} countLabel={t('sw_created')} />
      case 'produits':
        return <LauncherStep icon={Package} count={ctx.productsCount} unit={t('sw_products')} desc={t('sw_products_desc')} href="/produits" launch={launch} openLabel={t('sw_open')} countLabel={t('sw_created')} />
      case 'codesbarres':
        return <LauncherStep icon={Barcode} count={ctx.barcodedCount} unit={t('sw_barcoded')} desc={t('sw_barcodes_desc')} href="/produits/codes-barres" launch={launch} optional onSkip={() => markDone('codesbarres')} skipLabel={t('sw_skip')} openLabel={t('sw_open')} countLabel={t('sw_barcoded')} />
      case 'wms':
        return <LauncherStep icon={MapPin} count={ctx.zonesCount} unit={t('sw_zones')} desc={t('sw_wms_desc')} href="/magasins/zones" launch={launch} optional onSkip={() => markDone('wms')} skipLabel={t('sw_skip')} openLabel={t('sw_open')} countLabel={t('sw_zones')} />
      case 'stockinitial':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('sw_stockinit_desc')}</p>
            <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold ${ctx.stockInitDone ? 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-gray-200 text-gray-500 dark:border-white/10 dark:text-zinc-400'}`}>
              {ctx.stockInitDone ? <><CheckCircle2 className="h-4 w-4" />{t('sw_stockinit_done')}</> : <>{t('sw_stockinit_todo')}</>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => launch('/stock/stock-initial')} className="btn-primary"><ExternalLink className="h-4 w-4" />{t('sw_open')}</button>
              {!ctx.stockInitDone && <button onClick={() => markDone('stockinitial')} className="btn-secondary"><SkipForward className="h-4 w-4" />{t('sw_skip')}</button>}
            </div>
          </div>
        )
      case 'verification':
        return (
          <div className="space-y-2">
            <p className="mb-2 text-sm text-gray-500 dark:text-zinc-400">{t('sw_verif_hint')}</p>
            {SETUP_STEPS.filter((s) => s.key !== 'verification').map((s) => {
              const ok = isStepDone(s.key, ctx)
              return (
                <div key={s.key} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-white/10">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full ${ok ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400 dark:bg-white/10'}`}>{ok ? <Check className="h-3.5 w-3.5" /> : '·'}</span>
                  <span className={`text-sm ${ok ? 'font-semibold text-gray-800 dark:text-zinc-100' : 'text-gray-400 dark:text-zinc-500'}`}>{s[L]}</span>
                  {!s.required && <span className="ml-auto text-[10px] font-semibold uppercase text-gray-300 dark:text-zinc-600">{t('sw_optional')}</span>}
                </div>
              )
            })}
          </div>
        )
      case 'sauvegarde':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('sw_backup_desc')}</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { launch('/parametres/sauvegarde') }} className="btn-primary"><Save className="h-4 w-4" />{t('sw_backup_open')}</button>
              <button onClick={() => markDone('sauvegarde')} className="btn-secondary"><Check className="h-4 w-4" />{t('sw_backup_confirm')}</button>
            </div>
          </div>
        )
    }
  }

  const CurIcon = ICONS[current.icon] ?? Store
  const canNext = !current.required || currentDone
  const allDone = isStepDone('verification', ctx) && isStepDone('sauvegarde', ctx)

  return (
    <div className="mx-auto max-w-5xl">
      {/* En-tête + progression */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <Rocket className="h-6 w-6 text-amber-500" />{t('sw_title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('sw_subtitle')}</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500" animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
          </div>
          <span className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">{done}/{total}</span>
        </div>
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        {/* Stepper */}
        <nav className="lg:sticky lg:top-20 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {SETUP_STEPS.map((s, i) => {
              const ok = isStepDone(s.key, ctx)
              const active = i === step
              const Icon = ICONS[s.icon] ?? Store
              return (
                <li key={s.key} className="shrink-0 lg:shrink">
                  <button onClick={() => goStep(i)} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${active ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-white/10'}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${ok ? 'bg-emerald-500 text-white' : active ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-500 dark:bg-white/10'}`}>{ok ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                    <Icon className="hidden h-4 w-4 shrink-0 lg:block" />
                    <span className="whitespace-nowrap font-semibold lg:whitespace-normal">{s[L]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Panneau de l'étape */}
        <div>
          <AnimatePresence mode="wait">
            <motion.div key={current.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
              className="rounded-2xl border border-white/40 bg-white/70 p-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5 sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400"><CurIcon className="h-5 w-5" /></span>
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">{current[L]}{currentDone && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}</h2>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('sw_step')} {step + 1}/{total}{!current.required && ` · ${t('sw_optional')}`}</p>
                </div>
              </div>
              {stepBody()}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <button onClick={() => goStep(step - 1)} disabled={step === 0} className="btn-secondary disabled:opacity-40"><ChevronLeft className="h-4 w-4" />{t('sw_prev')}</button>
            {step === total - 1 ? (
              <button onClick={finish} disabled={!allDone} className="btn-primary disabled:opacity-50"><Sparkles className="h-4 w-4" />{t('sw_finish')}</button>
            ) : (
              <button onClick={() => goStep(step + 1)} disabled={!canNext} className="btn-primary disabled:opacity-50">{t('sw_next')}<ChevronRight className="h-4 w-4" /></button>
            )}
          </div>
          {!canNext && <p className="mt-2 text-right text-xs text-rose-500">{t('sw_blocked')}</p>}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  )
}

function LaunchLink({ onClick, label }: { onClick: () => void; label: string }) {
  return <button onClick={onClick} className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 hover:underline dark:text-amber-400"><ExternalLink className="h-4 w-4" />{label}</button>
}

function LauncherStep(props: {
  icon: typeof Store; count: number; unit: string; desc: string; href: string; launch: (h: string) => void
  optional?: boolean; onSkip?: () => void; skipLabel?: string; openLabel: string; countLabel: string
}) {
  const { icon: Icon, count, desc, href, launch, optional, onSkip, skipLabel, openLabel, countLabel } = props
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-zinc-400">{desc}</p>
      <div className={`flex items-center gap-3 rounded-xl border p-3 ${count > 0 ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-gray-200 dark:border-white/10'}`}>
        <Icon className={`h-5 w-5 ${count > 0 ? 'text-emerald-500' : 'text-gray-400'}`} />
        <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{count}</span>
        <span className="text-sm text-gray-500 dark:text-zinc-400">{countLabel}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => launch(href)} className="btn-primary"><ExternalLink className="h-4 w-4" />{openLabel}</button>
        {optional && count === 0 && onSkip && <button onClick={onSkip} className="btn-secondary"><SkipForward className="h-4 w-4" />{skipLabel}</button>}
      </div>
    </div>
  )
}

export default function SetupPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
