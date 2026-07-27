'use client'

import { motion } from 'framer-motion'
import { Info, Printer, RefreshCw, RotateCw } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useLanguage } from '@/lib/i18n'

type Bi = { fr: string; ar: string }
interface Step { path?: Bi; desc: Bi }
interface Phase { n: string; accent: string; badge: string; cadence: Bi; icon: string; title: Bi; steps: Step[] }

const PHASES: Phase[] = [
  {
    n: '0', accent: 'border-amber-500', badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    icon: '🔁', cadence: { fr: "Au début de l'année", ar: 'في بداية السنة' },
    title: { fr: "Ouverture de l'exercice", ar: 'فتح الدورة' },
    steps: [
      { desc: { fr: 'Se connecter en **Administrateur** (accès complet au paramétrage).', ar: 'الدخول بصفة **مدير** (وصول كامل للإعداد).' } },
      { path: { fr: 'Paramètres › Société', ar: 'الإعدادات › الشركة' }, desc: { fr: 'Nom, logo, ICE / IF / RC / Patente, adresse, téléphone, devise, **TVA %**, numérotation des factures.', ar: 'الاسم، الشعار، ICE / IF / RC / الباتنتة، العنوان، الهاتف، العملة، **الضريبة٪**، ترقيم الفواتير.' } },
      { path: { fr: 'Paramètres › Impression', ar: 'الإعدادات › الطباعة' }, desc: { fr: 'Format ticket (58/80 mm), étiquette Zebra, message du ticket.', ar: 'حجم التذكرة (58/80 مم)، ملصق Zebra، رسالة التذكرة.' } },
      { path: { fr: 'Magasins › Dépôts', ar: 'المتاجر › المستودعات' }, desc: { fr: 'Vérifier/créer magasins et dépôts, choisir le **magasin actif**.', ar: 'التحقق/إنشاء المتاجر والمستودعات، واختيار **المتجر النشط**.' } },
      { path: { fr: 'Utilisateurs › Permissions', ar: 'المستخدمون › الصلاحيات' }, desc: { fr: 'Créer les comptes (Gérant, Magasinier, Caissier…) et régler les droits.', ar: 'إنشاء الحسابات (مدير، أمين مخزن، صندوق…) وضبط الصلاحيات.' } },
      { path: { fr: 'Paramètres › Réinitialisation des statistiques', ar: 'الإعدادات › إعادة تعيين الإحصائيات' }, desc: { fr: "Poser la **date de début d'exercice** : compteurs et rapports à zéro, **sans supprimer aucune donnée**.", ar: 'تحديد **تاريخ بداية الدورة**: العدادات والتقارير من الصفر، **دون حذف أي بيانات**.' } },
      { path: { fr: 'Paramètres › Sauvegarde', ar: 'الإعدادات › النسخ الاحتياطي' }, desc: { fr: "Première sauvegarde de référence de l'exercice.", ar: 'أول نسخة احتياطية مرجعية للدورة.' } },
    ],
  },
  {
    n: '1', accent: 'border-indigo-500', badge: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    icon: '🔁', cadence: { fr: 'À la mise en service', ar: 'عند التشغيل' },
    title: { fr: 'Constitution du stock de départ', ar: 'تكوين المخزون الأولي' },
    steps: [
      { path: { fr: 'Produits › Catégories · Marques · Unités', ar: 'المنتجات › الفئات · العلامات · الوحدات' }, desc: { fr: 'Compléter le référentiel du catalogue.', ar: 'إكمال مرجع الكتالوج.' } },
      { path: { fr: 'Produits › Produits', ar: 'المنتجات › المنتجات' }, desc: { fr: 'Créer ou importer les articles : **prix d’achat HT**, prix de vente, stock minimum.', ar: 'إنشاء أو استيراد الأصناف: **سعر الشراء**، سعر البيع، الحد الأدنى للمخزون.' } },
      { path: { fr: 'Produits › Codes-barres', ar: 'المنتجات › الرموز الشريطية' }, desc: { fr: 'Générer les EAN-13 manquants, imprimer les étiquettes Zebra, tester la douchette.', ar: 'توليد رموز EAN-13 الناقصة، طباعة ملصقات Zebra، اختبار الماسح.' } },
      { path: { fr: 'Stock › Stock initial', ar: 'المخزون › المخزون الأولي' }, desc: { fr: 'Saisir les quantités de départ (manuel, scan+quantité, scan répétitif ou **import Excel/CSV**), choisir le **dépôt**, contrôler la **valeur du stock**, puis **Valider**.', ar: 'إدخال الكميات الأولية (يدوي، مسح+كمية، مسح متكرر أو **استيراد Excel/CSV**)، اختيار **المستودع**، مراقبة **قيمة المخزون**، ثم **تأكيد**.' } },
      { path: { fr: 'Magasins › Zones … Emplacements', ar: 'المتاجر › المناطق … المواقع' }, desc: { fr: '*Optionnel* : organiser les emplacements physiques (WMS) et les affecter aux produits.', ar: '*اختياري*: تنظيم المواقع الفعلية (WMS) وربطها بالمنتجات.' } },
    ],
  },
  {
    n: '2', accent: 'border-emerald-500', badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    icon: '📅', cadence: { fr: 'Chaque jour', ar: 'كل يوم' },
    title: { fr: 'Exploitation quotidienne', ar: 'التشغيل اليومي' },
    steps: [
      { path: { fr: 'Caisse › Ouvrir la caisse', ar: 'الصندوق › فتح الصندوق' }, desc: { fr: 'Saisir le **fond de caisse** (obligatoire avant tout encaissement).', ar: 'إدخال **رصيد البداية** (إلزامي قبل أي تحصيل).' } },
      { path: { fr: 'Point de vente (POS)', ar: 'نقطة البيع' }, desc: { fr: 'Scanner les articles, quantités/remises, client, **dépôt de vente**, mode de paiement → **Encaisser**.', ar: 'مسح الأصناف، الكميات/الخصومات، العميل، **مستودع البيع**، طريقة الدفع ← **التحصيل**.' } },
      { path: { fr: 'Ventes › Factures · Devis · BL · Retours', ar: 'المبيعات › الفواتير · العروض · سند التسليم · المرتجعات' }, desc: { fr: 'Établir et suivre les documents de vente.', ar: 'إصدار ومتابعة وثائق البيع.' } },
      { path: { fr: 'Clients › Crédits · Fidélité', ar: 'العملاء › الديون · الوفاء' }, desc: { fr: 'Suivi des encours clients et des points de fidélité.', ar: 'متابعة ديون العملاء ونقاط الوفاء.' } },
      { path: { fr: 'Achats › Réception', ar: 'المشتريات › الاستلام' }, desc: { fr: 'Bon de commande → **Réception** (le stock monte, avec dépôt) → Facture → Paiement.', ar: 'سند طلبية ← **الاستلام** (يرتفع المخزون، مع المستودع) ← الفاتورة ← الدفع.' } },
      { path: { fr: "Caisse › Dépenses · Recettes · Transfert d'argent", ar: 'الصندوق › المصاريف · المداخيل · تحويل الأموال' }, desc: { fr: 'Mouvements de trésorerie du jour.', ar: 'حركات الخزينة لليوم.' } },
      { path: { fr: 'Caisse › Fin de journée → Fermer la caisse', ar: 'الصندوق › نهاية اليوم ← إغلاق الصندوق' }, desc: { fr: 'Comptage, écart, clôture journalière.', ar: 'الإحصاء، الفارق، الإقفال اليومي.' } },
    ],
  },
  {
    n: '3', accent: 'border-cyan-500', badge: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
    icon: '🗓️', cadence: { fr: 'Hebdo / Mensuel', ar: 'أسبوعي / شهري' },
    title: { fr: 'Suivi périodique', ar: 'المتابعة الدورية' },
    steps: [
      { path: { fr: 'Stock › Réapprovisionnement', ar: 'المخزون › إعادة التموين' }, desc: { fr: 'Commander les articles passés sous le seuil (trié par emplacement).', ar: 'طلب الأصناف تحت الحد الأدنى (مرتبة حسب الموقع).' } },
      { path: { fr: 'Stock › Inventaire physique', ar: 'المخزون › الجرد الفعلي' }, desc: { fr: 'Comptage (par emplacement / douchette), régularisation des écarts.', ar: 'الإحصاء (حسب الموقع / الماسح)، تسوية الفوارق.' } },
      { path: { fr: 'Stock › Transferts · Stock par dépôt', ar: 'المخزون › التحويلات · المخزون حسب المستودع' }, desc: { fr: 'Équilibrer les magasins et dépôts, contrôler la ventilation par dépôt.', ar: 'موازنة المتاجر والمستودعات، مراقبة التوزيع حسب المستودع.' } },
      { path: { fr: 'Rapports', ar: 'التقارير' }, desc: { fr: 'Ventes, marges, bénéfices, stock, caisse, clients (avec **export**).', ar: 'المبيعات، الهوامش، الأرباح، المخزون، الصندوق، العملاء (مع **تصدير**).' } },
      { path: { fr: 'Alertes', ar: 'التنبيهات' }, desc: { fr: 'Stock critique et crédits clients échus.', ar: 'المخزون الحرج وديون العملاء المستحقة.' } },
      { path: { fr: 'Paramètres › Sauvegarde', ar: 'الإعدادات › النسخ الاحتياطي' }, desc: { fr: 'Sauvegarde régulière (ou l’archive ZIP « Save Droguerie »).', ar: 'نسخ احتياطي منتظم (أو أرشيف ZIP «Save Droguerie»).' } },
    ],
  },
  {
    n: '4', accent: 'border-rose-500', badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    icon: '🏁', cadence: { fr: "En fin d'année", ar: 'في نهاية السنة' },
    title: { fr: "Clôture de l'exercice", ar: 'إقفال الدورة' },
    steps: [
      { path: { fr: 'Stock › Inventaire physique', ar: 'المخزون › الجرد الفعلي' }, desc: { fr: '**Inventaire complet** de tous les articles → ajustements finaux.', ar: '**جرد كامل** لجميع الأصناف ← التسويات النهائية.' } },
      { path: { fr: 'Clients › Crédits', ar: 'العملاء › الديون' }, desc: { fr: 'Encaisser ou régulariser les crédits clients en cours.', ar: 'تحصيل أو تسوية ديون العملاء الجارية.' } },
      { path: { fr: 'Achats › Paiements', ar: 'المشتريات › المدفوعات' }, desc: { fr: 'Solder les dettes fournisseurs.', ar: 'تسوية ديون الموردين.' } },
      { path: { fr: 'Caisse › Fin de journée → Fermer la caisse', ar: 'الصندوق › نهاية اليوم ← إغلاق الصندوق' }, desc: { fr: 'Dernière clôture de caisse de l’année.', ar: 'آخر إقفال للصندوق في السنة.' } },
      { path: { fr: 'Rapports (période = exercice)', ar: 'التقارير (الفترة = الدورة)' }, desc: { fr: 'Éditer et **exporter** : chiffre d’affaires, marges, bénéfices, dépenses, **valeur du stock de clôture**.', ar: 'إصدار و**تصدير**: رقم المعاملات، الهوامش، الأرباح، المصاريف، **قيمة مخزون الإقفال**.' } },
      { path: { fr: 'Paramètres › Sauvegarde', ar: 'الإعدادات › النسخ الاحتياطي' }, desc: { fr: '**Archive de fin d’exercice**, à conserver précieusement.', ar: '**أرشيف نهاية الدورة**، يُحفظ بعناية.' } },
      { path: { fr: 'Paramètres › Réinitialisation des statistiques', ar: 'الإعدادات › إعادة تعيين الإحصائيات' }, desc: { fr: 'Poser la nouvelle **date de début d’exercice** : les compteurs repartent à zéro (l’historique reste consultable).', ar: 'تحديد **تاريخ بداية الدورة** الجديد: تعود العدادات إلى الصفر (يبقى السجل متاحًا).' } },
    ],
  },
]

function renderText(txt: string) {
  return txt.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-gray-800 dark:text-zinc-100">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i} className="text-gray-400 dark:text-zinc-500">{part.slice(1, -1)}</em>
    return <span key={i}>{part}</span>
  })
}

function Content() {
  const { t, lang } = useLanguage()
  const L = lang as 'fr' | 'ar'

  return (
    <>
      <style>{`@media print { aside, header.app-header { display:none !important } main { padding:0 !important } .guide-noprint{display:none !important} .phase-card{break-inside:avoid} }`}</style>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <RefreshCw className="h-6 w-6 text-amber-500" />
            {t('gx_title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('gx_subtitle')}</p>
        </div>
        <button onClick={() => window.print()} className="btn-primary guide-noprint"><Printer className="h-4 w-4" />{t('gx_print')}</button>
      </motion.div>

      {/* Légende cadence */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500 dark:text-zinc-400">
        <span className="font-semibold text-gray-600 dark:text-zinc-300">{t('gx_cadence')} :</span>
        <span>🔁 {t('gx_cad_once')}</span>
        <span>📅 {t('gx_cad_daily')}</span>
        <span>🗓️ {t('gx_cad_period')}</span>
        <span>🏁 {t('gx_cad_close')}</span>
      </div>

      {/* Phases */}
      <div className="space-y-4">
        {PHASES.map((ph) => (
          <motion.section key={ph.n} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className={`phase-card glass-card overflow-hidden border-l-4 ${ph.accent}`}>
            <div className="flex items-center gap-3 border-b border-gray-100 p-4 dark:border-white/10 sm:p-5">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold ${ph.badge}`}>{ph.n}</span>
              <h2 className="text-base font-bold text-gray-900 dark:text-white sm:text-lg">{ph.title[L]}</h2>
              <span className={`ml-auto shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${ph.badge}`}>{ph.icon} {ph.cadence[L]}</span>
            </div>
            <ol className="divide-y divide-gray-50 dark:divide-white/5">
              {ph.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[12px] font-bold text-gray-500 dark:bg-white/10 dark:text-zinc-400">{i + 1}</span>
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-300">
                    {s.path?.[L] && <span className="mr-1.5 inline-block rounded-md bg-amber-50 px-2 py-0.5 font-mono text-[12px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">{s.path[L]}</span>}
                    {renderText(s.desc[L])}
                  </p>
                </li>
              ))}
            </ol>
          </motion.section>
        ))}
      </div>

      {/* Boucle */}
      <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-gradient-to-r from-rose-50 to-amber-50 p-4 dark:border-white/10 dark:from-rose-500/10 dark:to-amber-500/10">
        <RotateCw className="h-6 w-6 shrink-0 text-amber-500" />
        <p className="text-sm text-gray-700 dark:text-zinc-200">{t('gx_loop')}</p>
      </div>

      {/* Note importante */}
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-gray-200 p-4 dark:border-white/15">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <p className="text-sm text-gray-600 dark:text-zinc-300">{renderText(t('gx_note'))}</p>
      </div>

      {/* Bonnes pratiques */}
      <div className="glass-card p-5">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('gx_tips_title')}</h3>
        <ul className="grid gap-2">
          {['gx_tip1', 'gx_tip2', 'gx_tip3', 'gx_tip4', 'gx_tip5'].map((k) => (
            <li key={k} className="flex items-start gap-2 text-sm text-gray-600 dark:text-zinc-300">
              <span className="font-bold text-amber-500">✓</span>{renderText(t(k as Parameters<typeof t>[0]))}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

export default function GuideExercicePage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
