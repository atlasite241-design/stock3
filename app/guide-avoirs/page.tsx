'use client'

/*
 * GUIDE DES AVOIRS — le circuit complet, client et fournisseur, sous les yeux
 * de l'équipe. Même patron que les autres guides (exercice, exploitation) :
 * bilingue, imprimable, chaque étape pointe l'écran exact où elle se joue.
 *
 * Le schéma en tête de chaque section montre la CHAÎNE ; les étapes détaillent.
 */

import { motion } from 'framer-motion'
import { ArrowDown, FileMinus, Info, Printer } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useLanguage } from '@/lib/i18n'

type Bi = { fr: string; ar: string }
interface Step { path?: Bi; desc: Bi }
interface Flow {
  accent: string
  badge: string
  icon: string
  title: Bi
  subtitle: Bi
  /** La chaîne résumée, maillon par maillon. */
  chain: Bi[]
  steps: Step[]
}

const FLOWS: Flow[] = [
  {
    accent: 'border-amber-500', badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', icon: '🧾',
    title: { fr: 'Avoir client', ar: 'إشعار دائن للعميل' },
    subtitle: {
      fr: 'Corriger une facture client — après un retour de marchandise, une erreur de facturation ou un geste commercial.',
      ar: 'تصحيح فاتورة عميل — بعد إرجاع بضاعة أو خطأ في الفوترة أو بادرة تجارية.',
    },
    chain: [
      { fr: 'Facture client', ar: 'فاتورة العميل' },
      { fr: 'Retour client (si marchandise rendue)', ar: 'إرجاع العميل (إن أُعيدت البضاعة)' },
      { fr: 'Générer l’avoir', ar: 'إنشاء الإشعار' },
      { fr: 'Validation', ar: 'الاعتماد' },
      { fr: 'Utilisation en caisse ou remboursement', ar: 'استخدام في الصندوق أو استرداد' },
      { fr: 'Avoir soldé', ar: 'إشعار مسدد' },
    ],
    steps: [
      {
        path: { fr: 'Ventes › Retours clients', ar: 'المبيعات › إرجاعات العملاء' },
        desc: {
          fr: "**Si le client rend la marchandise** : enregistrer d'abord le retour. C'est LUI qui remet le stock à jour — jamais l'avoir. Les quantités sont plafonnées à ce qui a été vendu.",
          ar: '**إذا أعاد العميل البضاعة**: سجّل الإرجاع أولًا. هو الذي يحدّث المخزون — وليس الإشعار أبدًا. الكميات محدودة بما بيع.',
        },
      },
      {
        path: { fr: 'Ventes › Factures › œil › Générer un avoir', ar: 'المبيعات › الفواتير › عين › إنشاء إشعار' },
        desc: {
          fr: "Ouvrir la facture d'origine et cliquer **Générer un avoir**. Choisir les **quantités** ligne par ligne (jamais un montant libre), le **motif**, puis créer. Numéro **AC-2026-000001**, statut *Brouillon*. Le total des avoirs d'une facture ne peut pas dépasser la facture — seul le gérant peut forcer.",
          ar: 'افتح الفاتورة الأصلية واضغط **إنشاء إشعار**. اختر **الكميات** سطرًا سطرًا (لا مبلغًا حرًّا)، ثم **السبب**، ثم أنشئ. الرقم **AC-2026-000001**، الحالة *مسودة*. مجموع إشعارات الفاتورة لا يتجاوزها — المدير وحده يفرض.',
        },
      },
      {
        path: { fr: 'Ventes › Avoirs clients › ✓', ar: 'المبيعات › إشعارات العملاء › ✓' },
        desc: {
          fr: "**Valider** l'avoir (droit « Valider un avoir client »). Avant validation, il ne vaut rien ; après, il devient utilisable et son document A4 peut être remis au client.",
          ar: '**اعتمد** الإشعار (صلاحية «اعتماد إشعار العميل»). قبل الاعتماد لا قيمة له؛ بعده يصبح قابلًا للاستخدام ويمكن تسليم وثيقته A4 للعميل.',
        },
      },
      {
        path: { fr: 'Caisse — au prochain achat', ar: 'الصندوق — عند الشراء القادم' },
        desc: {
          fr: "Sélectionner le client au paiement : l'encart vert **« Avoir disponible »** apparaît. Cocher **Utiliser un avoir** — le montant appliqué et le **reste à payer** s'affichent. L'avoir est imputé sur la vente, traçable des deux côtés.",
          ar: 'اختر العميل عند الدفع: يظهر الإطار الأخضر **«إشعار متاح»**. أشّر **استخدام إشعار** — يظهر المبلغ المطبق و**المتبقي للدفع**. يُحسب الإشعار على البيع، متتبَّعًا من الجهتين.',
        },
      },
      {
        path: { fr: 'Ventes › Avoirs clients › 💵', ar: 'المبيعات › إشعارات العملاء › 💵' },
        desc: {
          fr: "*Ou bien* **rembourser** le client (droit dédié) : montant + mode. L'argent **sort de la caisse** et l'opération se voit dans l'historique de l'avoir. Un remboursement enregistré par erreur s'annule depuis ce même historique.",
          ar: '*أو* **استرداد** للعميل (صلاحية خاصة): المبلغ + الطريقة. المال **يخرج من الصندوق** وتظهر العملية في سجل الإشعار. الاسترداد الخاطئ يُلغى من السجل نفسه.',
        },
      },
      {
        desc: {
          fr: "Statuts dans l'ordre : *Brouillon → Validé → Partiellement utilisé → Soldé*. **Annulé** n'est possible que tant que rien n'a été consommé, avec un **motif obligatoire** — l'avoir reste dans l'historique, il ne disparaît jamais.",
          ar: 'الحالات بالترتيب: *مسودة ← معتمد ← مستخدم جزئيًا ← مسدد*. **الإلغاء** ممكن فقط ما لم يُستهلك شيء، مع **سبب إلزامي** — يبقى الإشعار في السجل ولا يختفي أبدًا.',
        },
      },
    ],
  },
  {
    accent: 'border-sky-500', badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', icon: '🚚',
    title: { fr: 'Avoir fournisseur', ar: 'إشعار دائن من المورد' },
    subtitle: {
      fr: "Correction ou retour sur une facture fournisseur — c'est le fournisseur qui NOUS doit.",
      ar: 'تصحيح أو إرجاع على فاتورة مورد — المورد هو من يدين لنا.',
    },
    chain: [
      { fr: 'Bon de commande', ar: 'سند الطلبية' },
      { fr: 'Réception (BL fournisseur)', ar: 'الاستلام (سند تسليم المورد)' },
      { fr: 'Facture fournisseur', ar: 'فاتورة المورد' },
      { fr: 'Retour fournisseur (si marchandise renvoyée)', ar: 'إرجاع للمورد (إن أُعيدت البضاعة)' },
      { fr: 'Générer l’avoir', ar: 'إنشاء الإشعار' },
      { fr: 'Validation → déduction ou remboursement', ar: 'الاعتماد ← خصم أو استرداد' },
    ],
    steps: [
      {
        path: { fr: 'Achats › Réception', ar: 'المشتريات › الاستلام' },
        desc: {
          fr: "À la réception, saisir la **référence de la facture du fournisseur** et son **numéro de BL** : ce sont ces références qui figureront sur l'avoir — c'est avec elles qu'on se fait rembourser.",
          ar: 'عند الاستلام، أدخل **مرجع فاتورة المورد** و**رقم سند تسليمه**: هذه المراجع ستظهر على الإشعار — وبها نسترد أموالنا.',
        },
      },
      {
        path: { fr: 'Achats › Retours fournisseurs', ar: 'المشتريات › إرجاعات الموردين' },
        desc: {
          fr: "**Si la marchandise repart chez le fournisseur** : enregistrer d'abord le retour — c'est LUI qui fait sortir le stock. L'avoir ne touche jamais au stock.",
          ar: '**إذا رجعت البضاعة إلى المورد**: سجّل الإرجاع أولًا — هو الذي يُخرج المخزون. الإشعار لا يمس المخزون أبدًا.',
        },
      },
      {
        path: { fr: 'Achats › Factures › 🖨 › Générer un avoir', ar: 'المشتريات › الفواتير › 🖨 › إنشاء إشعار' },
        desc: {
          fr: "Ouvrir la facture d'achat, **Générer un avoir**, choisir quantités et motif. Numéro **AF-2026-000001**. Le document reprend la facture du fournisseur, son BL, et la référence du retour s'il y en a un.",
          ar: 'افتح فاتورة الشراء، **إنشاء إشعار**، اختر الكميات والسبب. الرقم **AF-2026-000001**. تحمل الوثيقة فاتورة المورد وسند تسليمه ومرجع الإرجاع إن وُجد.',
        },
      },
      {
        path: { fr: 'Achats › Avoirs fournisseurs › ✓', ar: 'المشتريات › إشعارات الموردين › ✓' },
        desc: {
          fr: "**Valider**, imprimer le document A4 et l'envoyer au fournisseur pour accord.",
          ar: '**اعتمد**، اطبع وثيقة A4 وأرسلها إلى المورد للموافقة.',
        },
      },
      {
        path: { fr: 'Achats › Avoirs fournisseurs › 💵', ar: 'المشتريات › إشعارات الموردين › 💵' },
        desc: {
          fr: "Quand le fournisseur rembourse : enregistrer le **remboursement** (montant + mode) — l'argent **entre en caisse**. S'il préfère déduire d'une prochaine facture, l'avoir reste disponible jusqu'à imputation.",
          ar: 'عندما يسترد المورد: سجّل **الاسترداد** (المبلغ + الطريقة) — المال **يدخل الصندوق**. وإن فضّل الخصم من فاتورة قادمة، يبقى الإشعار متاحًا حتى الاحتساب.',
        },
      },
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
            <FileMinus className="h-6 w-6 text-amber-500" />
            {t('gav_title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('gav_subtitle')}</p>
        </div>
        <button onClick={() => window.print()} className="btn-primary guide-noprint"><Printer className="h-4 w-4" />{t('gx_print')}</button>
      </motion.div>

      {FLOWS.map((f) => (
        <motion.section key={f.title.fr} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className={`phase-card glass-card overflow-hidden border-l-4 ${f.accent}`}>
          <div className="flex items-center gap-3 border-b border-gray-100 p-4 dark:border-white/10 sm:p-5">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${f.badge}`}>{f.icon}</span>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white sm:text-lg">{f.title[L]}</h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{f.subtitle[L]}</p>
            </div>
          </div>

          {/* La chaîne, maillon par maillon — le workflow d'un seul regard. */}
          <div className="flex flex-col items-stretch gap-1 border-b border-gray-100 p-4 dark:border-white/10 sm:p-5">
            {f.chain.map((c, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className={`w-full max-w-md rounded-xl border px-4 py-2 text-center text-sm font-semibold ${i === f.chain.length - 1 ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400' : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200'}`}>
                  {c[L]}
                </div>
                {i < f.chain.length - 1 && <ArrowDown className="my-0.5 h-4 w-4 text-amber-500" />}
              </div>
            ))}
          </div>

          <ol className="divide-y divide-gray-50 dark:divide-white/5">
            {f.steps.map((s, i) => (
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

      {/* Les trois règles qui gouvernent tout le module. */}
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-gray-200 p-4 dark:border-white/15">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="space-y-1 text-sm text-gray-600 dark:text-zinc-300">
          <p>{renderText(t('gav_rule1'))}</p>
          <p>{renderText(t('gav_rule2'))}</p>
          <p>{renderText(t('gav_rule3'))}</p>
        </div>
      </div>
    </>
  )
}

export default function GuideAvoirsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
