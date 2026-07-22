'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Printer, RotateCcw, Rocket, Smartphone } from 'lucide-react'
import AppShell from '@/components/AppShell'
import InstallQR from '@/components/InstallQR'
import { useToast } from '@/components/Toast'
import { useLanguage } from '@/lib/i18n'

type Bi = { fr: string; ar: string }
interface Step { id: string; fr: string; ar: string; warn?: boolean }
interface Phase { n: string; accent: string; title: Bi; hint?: Bi; steps: Step[] }

const PHASES: Phase[] = [
  {
    n: '0', accent: 'border-amber-500', title: { fr: 'Connexion & paramétrage de base', ar: 'الدخول والإعداد الأساسي' },
    hint: { fr: 'À faire une seule fois', ar: 'يُنجز مرة واحدة' },
    steps: [
      { id: 's0a', fr: 'Se connecter en **Administrateur** (première mise en service).', ar: 'الدخول بصفة **مدير** (أول تشغيل).' },
      { id: 's0b', fr: '**Paramètres › Société** — nom, logo, ICE / IF / RC / Patente, adresse, téléphone, **Devise**, **TVA (%)**, numérotation des factures.', ar: '**الإعدادات › الشركة** — الاسم، الشعار، ICE / IF / RC / الباتنتة، العنوان، الهاتف، **العملة**، **الضريبة٪**، ترقيم الفواتير.' },
      { id: 's0c', fr: '**Paramètres › Impression** — format ticket (58/80 mm), format d’étiquette (mm) pour la Zebra, message du ticket.', ar: '**الإعدادات › الطباعة** — حجم التذكرة (58/80 مم)، حجم الملصق (مم) لطابعة Zebra، رسالة التذكرة.' },
      { id: 's0d', fr: '**Magasins** — vérifier/créer magasins & dépôts, choisir le **magasin actif** (barre du haut).', ar: '**المتاجر** — التحقق/إنشاء المتاجر والمستودعات، واختيار **المتجر النشط** (الشريط العلوي).' },
    ],
  },
  {
    n: '1', accent: 'border-indigo-500', title: { fr: 'Utilisateurs, rôles & permissions', ar: 'المستخدمون والأدوار والصلاحيات' },
    steps: [
      { id: 's1a', fr: '**Utilisateurs › Employés** — créer les comptes (Gérant, Magasinier, Caissier, Vendeur).', ar: '**المستخدمون › الموظفون** — إنشاء الحسابات (مدير، أمين مخزن، صندوق، بائع).' },
      { id: 's1b', fr: '**Utilisateurs › Permissions** — ajuster par rôle ; override par utilisateur (icône bouclier).', ar: '**المستخدمون › الصلاحيات** — الضبط حسب الدور؛ تخصيص لكل مستخدم (أيقونة الدرع).' },
    ],
  },
  {
    n: '2', accent: 'border-violet-500', title: { fr: 'Catalogue & produits', ar: 'الكتالوج والمنتجات' },
    steps: [
      { id: 's2a', fr: '**Produits › Catégories / Sous-catégories / Marques / Unités** — vérifier/compléter.', ar: '**المنتجات › الفئات / الفئات الفرعية / العلامات / الوحدات** — التحقق/الإكمال.' },
      { id: 's2b', fr: '**Produits › Produits** — ajouter manuellement **ou** importer en masse via **Paramètres › Sauvegarde › Import CSV**.', ar: '**المنتجات › المنتجات** — الإضافة يدويًا **أو** الاستيراد بالجملة عبر **الإعدادات › النسخ الاحتياطي › استيراد CSV**.' },
      { id: 's2c', fr: 'Renseigner : nom, code-barres, catégorie, sous-catégorie, marque, unité, **prix d’achat HT**, prix de vente, stock min.', ar: 'إدخال: الاسم، الرمز الشريطي، الفئة، الفئة الفرعية، العلامة، الوحدة، **سعر الشراء**، سعر البيع، الحد الأدنى للمخزون.' },
    ],
  },
  {
    n: '3', accent: 'border-cyan-500', title: { fr: 'Codes-barres & étiquettes', ar: 'الرموز الشريطية والملصقات' },
    steps: [
      { id: 's3a', fr: '**Produits › Codes-barres** — générer les EAN-13 manquants, régler le format d’étiquette, **imprimer sur la Zebra**, tester la douchette.', ar: '**المنتجات › الرموز الشريطية** — توليد رموز EAN-13 الناقصة، ضبط حجم الملصق، **الطباعة على Zebra**، اختبار الماسح.' },
    ],
  },
  {
    n: '4', accent: 'border-rose-500', title: { fr: '★ Stock initial (mise en service)', ar: '★ المخزون الأولي (التشغيل)' },
    hint: { fr: "Le point de départ de l'inventaire", ar: 'نقطة انطلاق الجرد' },
    steps: [
      { id: 's4a', fr: '**Stock › Stock initial** — saisir la **quantité de départ** : au clavier, à la **douchette** (+1 par scan) ou par **import CSV** (code-barres ; quantité).', ar: '**المخزون › المخزون الأولي** — إدخال **الكمية الأولية**: بلوحة المفاتيح، بالماسح (+1 لكل مسح) أو عبر **استيراد CSV** (الرمز؛ الكمية).' },
      { id: 's4b', fr: 'Contrôler la **valeur du stock** (Qté × Prix d’achat) et les totaux.', ar: 'مراقبة **قيمة المخزون** (الكمية × سعر الشراء) والمجاميع.' },
      { id: 's4c', fr: '**Valider l’initialisation** → crée un mouvement **STOCK INITIAL** par produit, fixe le stock, avec magasin/utilisateur/date.', ar: '**تأكيد التهيئة** ← يُنشئ حركة **مخزون أولي** لكل منتج، ويحدد المخزون، مع المتجر/المستخدم/التاريخ.' },
      { id: 's4d', warn: true, fr: '⚠ Une seule fois par produit (les produits initialisés disparaissent). 2ᵉ initialisation réservée Gérant/Administrateur.', ar: '⚠ مرة واحدة لكل منتج (تختفي المنتجات المُهيّأة). التهيئة الثانية للمدير فقط.' },
    ],
  },
  {
    n: '5', accent: 'border-emerald-500', title: { fr: 'Approvisionnement (réachats)', ar: 'التموين (إعادة الشراء)' },
    steps: [
      { id: 's5a', fr: '**Fournisseurs** — créer les fournisseurs.', ar: '**الموردون** — إنشاء الموردين.' },
      { id: 's5b', fr: '**Achats** — Bon de commande → **Bon de réception** (le stock augmente) → Facture fournisseur → Paiement.', ar: '**المشتريات** — سند طلبية ← **سند استلام** (يرتفع المخزون) ← فاتورة المورد ← الدفع.' },
    ],
  },
  {
    n: '6', accent: 'border-amber-500', title: { fr: 'Ouverture de caisse', ar: 'فتح الصندوق' },
    steps: [
      { id: 's6a', fr: '**Caisse › Ouvrir la caisse** — saisir le **fond de caisse**. Obligatoire avant d’encaisser.', ar: '**الصندوق › فتح الصندوق** — إدخال **رصيد البداية**. إلزامي قبل التحصيل.' },
    ],
  },
  {
    n: '7', accent: 'border-rose-500', title: { fr: '★ Ventes & facturation', ar: '★ المبيعات والفوترة' },
    steps: [
      { id: 's7a', fr: '**Point de vente (POS) › Nouvelle vente** — scanner les produits, quantités/remises, client, mode de paiement, puis **Encaisser** → ticket ou facture.', ar: '**نقطة البيع › بيع جديد** — مسح المنتجات، الكميات/الخصومات، العميل، طريقة الدفع، ثم **التحصيل** ← تذكرة أو فاتورة.' },
      { id: 's7b', fr: '**Ventes › Devis** — créer un devis, générer le PDF, puis **Convertir en vente** (→ facture).', ar: '**المبيعات › عروض الأسعار** — إنشاء عرض، توليد PDF، ثم **التحويل إلى بيع** (← فاتورة).' },
      { id: 's7c', fr: '**Ventes › Factures / Avoirs / Retours** et **Clients › Crédits / Fidélité** pour le suivi.', ar: '**المبيعات › الفواتير / إشعارات دائنة / المرتجعات** و **العملاء › الديون / الوفاء** للمتابعة.' },
    ],
  },
  {
    n: '8', accent: 'border-indigo-500', title: { fr: 'Clôture, trésorerie & rapports', ar: 'الإقفال والخزينة والتقارير' },
    steps: [
      { id: 's8a', fr: '**Caisse › Dépenses / Recettes / Transfert d’argent** — trésorerie du jour.', ar: '**الصندوق › المصاريف / المداخيل / تحويل الأموال** — خزينة اليوم.' },
      { id: 's8b', fr: '**Caisse › Fin de journée** puis **Fermer la caisse** — comptage, écart, clôture.', ar: '**الصندوق › نهاية اليوم** ثم **إغلاق الصندوق** — الإحصاء، الفارق، الإقفال.' },
      { id: 's8c', fr: '**Rapports** — ventes, marges, stock, caisse, clients (+ export).', ar: '**التقارير** — المبيعات، الهوامش، المخزون، الصندوق، العملاء (+ تصدير).' },
    ],
  },
  {
    n: '9', accent: 'border-cyan-500', title: { fr: 'Sécurité & données', ar: 'الأمان والبيانات' },
    steps: [
      { id: 's9a', fr: '**Paramètres › Sauvegarde** — sauvegarde/restauration, synchronisation.', ar: '**الإعدادات › النسخ الاحتياطي** — النسخ/الاستعادة، المزامنة.' },
      { id: 's9b', fr: '**Utilisateurs › Journal d’activité** — audit (qui a fait quoi, ancienne → nouvelle valeur).', ar: '**المستخدمون › سجل النشاط** — التدقيق (من فعل ماذا، القيمة القديمة ← الجديدة).' },
    ],
  },
]

const ALL_IDS = PHASES.flatMap((p) => p.steps.filter((s) => !s.warn).map((s) => s.id))
const KEY = 'dp_guide_checks'

// Rend le texte avec les **menus** en gras.
function renderText(t: string) {
  return t.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-mono text-[12px] font-semibold text-amber-700 dark:text-amber-400">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}

function Content() {
  const { t, lang } = useLanguage()
  const toast = useToast()
  const [checks, setChecks] = useState<Set<string>>(new Set())
  const [appUrl, setAppUrl] = useState('')

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setChecks(new Set(JSON.parse(raw))) } catch {}
    setAppUrl(window.location.origin)
  }, [])

  const copyUrl = async () => {
    try { await navigator.clipboard.writeText(appUrl); toast(`✓ ${t('guide_copied')}`) } catch {}
  }

  const persist = (s: Set<string>) => { setChecks(new Set(s)); try { localStorage.setItem(KEY, JSON.stringify([...s])) } catch {} }
  const toggle = (id: string) => { const s = new Set(checks); s.has(id) ? s.delete(id) : s.add(id); persist(s) }
  const reset = () => persist(new Set())
  const done = ALL_IDS.filter((id) => checks.has(id)).length
  const pct = Math.round((done / ALL_IDS.length) * 100)

  return (
    <>
      <style>{`@media print { aside, header { display:none !important } main { padding:0 !important } .guide-noprint{display:none !important} }`}</style>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Rocket className="h-6 w-6 text-amber-500" />
            {t('guide_title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('guide_subtitle')}</p>
        </div>
        <div className="guide-noprint flex flex-wrap gap-3">
          <button onClick={reset} className="btn-secondary"><RotateCcw className="h-4 w-4" />{t('guide_reset')}</button>
          <button onClick={() => window.print()} className="btn-primary"><Printer className="h-4 w-4" />{t('guide_print')}</button>
        </div>
      </motion.div>

      {/* Installer sur mobile (QR) */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="glass-card flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
        <InstallQR url={appUrl} />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h2 className="flex items-center justify-center gap-2 text-base font-bold text-gray-900 dark:text-white sm:justify-start sm:text-lg">
            <Smartphone className="h-5 w-5 text-amber-500" />
            {t('guide_install_title')}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('guide_install_hint')}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="rounded-lg bg-gray-100 px-3 py-1.5 font-mono text-xs text-gray-700 dark:bg-white/10 dark:text-zinc-300">{appUrl}</span>
            <button onClick={copyUrl} className="btn-secondary !h-8 text-xs"><Copy className="h-3.5 w-3.5" />{t('guide_copy')}</button>
          </div>
        </div>
      </motion.div>

      {/* Progression — reste visible en haut pendant le défilement */}
      <div className="glass-card sticky top-16 z-20 p-5 shadow-md">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{done}/{ALL_IDS.length} {t('guide_progress')}</span>
          <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">{pct}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-4">
        {PHASES.map((ph) => (
          <motion.section
            key={ph.n}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className={`glass-card border-l-4 ${ph.accent} p-5 sm:p-6`}
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-sm font-extrabold text-white">{ph.n}</span>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white sm:text-lg">{ph.title[lang as 'fr' | 'ar']}</h2>
                {ph.hint && <p className="text-xs text-gray-500 dark:text-zinc-400">{ph.hint[lang as 'fr' | 'ar']}</p>}
              </div>
            </div>
            <ul className="space-y-1">
              {ph.steps.map((s) =>
                s.warn ? (
                  <li key={s.id} className="ml-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                    {s[lang as 'fr' | 'ar']}
                  </li>
                ) : (
                  <li key={s.id} className="flex items-start gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                    <input type="checkbox" checked={checks.has(s.id)} onChange={() => toggle(s.id)} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-amber-500" />
                    <span className={`text-sm ${checks.has(s.id) ? 'text-gray-400 line-through dark:text-zinc-500' : 'text-gray-700 dark:text-zinc-300'}`}>
                      {renderText(s[lang as 'fr' | 'ar'])}
                    </span>
                  </li>
                )
              )}
            </ul>
          </motion.section>
        ))}
      </div>
    </>
  )
}

export default function GuideDemarragePage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
