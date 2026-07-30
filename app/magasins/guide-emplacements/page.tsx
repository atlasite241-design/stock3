'use client'

import { motion } from 'framer-motion'
import { Boxes, Camera, Info, Layers, MousePointerClick, Printer, Sparkles, Wand2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useLanguage } from '@/lib/i18n'

type Bi = { fr: string; ar: string }

// --- Hiérarchie des emplacements (du plus large au plus fin) ---
const CHAIN: { code: string; label: Bi; note: Bi }[] = [
  { code: 'MAG01', label: { fr: 'Magasin', ar: 'المتجر' }, note: { fr: 'Le point de vente', ar: 'نقطة البيع' } },
  { code: 'DEP01', label: { fr: 'Dépôt', ar: 'المستودع' }, note: { fr: 'Réserve / entrepôt', ar: 'المخزن / المستودع' } },
  { code: 'B', label: { fr: 'Zone', ar: 'المنطقة' }, note: { fr: 'Une famille (ex : Électricité)', ar: 'عائلة (مثال: الكهرباء)' } },
  { code: '01', label: { fr: 'Allée', ar: 'الممر' }, note: { fr: 'Un couloir', ar: 'ممر' } },
  { code: 'R03', label: { fr: 'Rayon', ar: 'الرف' }, note: { fr: 'Une travée / meuble', ar: 'خزانة / رف' } },
  { code: 'E01', label: { fr: 'Étagère', ar: 'الرفّ' }, note: { fr: 'Une planche', ar: 'لوح' } },
  { code: 'N01', label: { fr: 'Niveau', ar: 'المستوى' }, note: { fr: 'Une hauteur', ar: 'ارتفاع' } },
  { code: 'P015', label: { fr: 'Emplacement', ar: 'الموقع' }, note: { fr: 'La case exacte du produit', ar: 'الخانة الدقيقة للمنتج' } },
]

interface Step { path?: Bi; desc: Bi }
interface Section { accent: string; badge: string; icon: LucideIcon; tag: Bi; title: Bi; intro?: Bi; steps: Step[] }

const SECTIONS: Section[] = [
  {
    accent: 'border-indigo-500', badge: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400', icon: MousePointerClick,
    tag: { fr: 'Méthode 1', ar: 'الطريقة 1' },
    title: { fr: 'Ajout manuel, pas à pas', ar: 'الإضافة اليدوية، خطوة بخطوة' },
    intro: { fr: 'Idéal pour ajouter ou corriger **quelques** emplacements. La règle : on choisit toujours les **parents d’abord** (du haut vers le bas), puis on ajoute l’élément.', ar: 'مثالي لإضافة أو تصحيح **بعض** المواقع. القاعدة: نختار دائمًا **الآباء أولًا** (من الأعلى للأسفل)، ثم نضيف العنصر.' },
    steps: [
      { path: { fr: 'En haut de l’écran', ar: 'أعلى الشاشة' }, desc: { fr: 'Vérifier le **magasin actif** (les emplacements lui appartiennent).', ar: 'التحقق من **المتجر النشط** (المواقع تخصّه).' } },
      { path: { fr: 'Magasins › Rayons', ar: 'المتاجر › الرفوف' }, desc: { fr: 'Ouvrir le niveau voulu : **Rayons**, puis **Étagères**, **Niveaux**, **Emplacements**.', ar: 'فتح المستوى المطلوب: **الرفوف**، ثم **الأرفف**، **المستويات**، **المواقع**.' } },
      { desc: { fr: 'Dans les **listes déroulantes** en haut, sélectionner les parents en cascade : la **Zone**, puis l’**Allée** (et le Rayon, l’Étagère… selon le niveau).', ar: 'من **القوائم المنسدلة** بالأعلى، اختيار الآباء بالتتابع: **المنطقة** ثم **الممر** (ثم الرف، الرفّ… حسب المستوى).' } },
      { path: { fr: 'Bouton « Ajouter »', ar: 'زر «إضافة»' }, desc: { fr: 'Cliquer sur **Ajouter** (il s’active une fois les parents choisis).', ar: 'الضغط على **إضافة** (يُفعَّل بعد اختيار الآباء).' } },
      { desc: { fr: 'Saisir le **Code** : 2 chiffres (ex : `03`). Le gris clair propose déjà le **prochain code libre**. Le préfixe (R / E / N / P) est ajouté **automatiquement**.', ar: 'إدخال **الرمز**: رقمان (مثال: `03`). اللون الرمادي يقترح **الرمز التالي المتاح**. البادئة (R / E / N / P) تُضاف **تلقائيًا**.' } },
      { desc: { fr: '*(Optionnel)* Ajouter un **Nom / activité** (ex : Peinture, Visserie) pour s’y retrouver — il n’entre pas dans le code.', ar: '*(اختياري)* إضافة **اسم / نشاط** (مثال: الطلاء، البراغي) للتنظيم — لا يدخل في الرمز.' } },
      { desc: { fr: 'Contrôler l’**aperçu de l’emplacement complet** affiché en bas, puis **Enregistrer**.', ar: 'التحقق من **معاينة الموقع الكامل** بالأسفل، ثم **حفظ**.' } },
      { desc: { fr: 'Répéter pour chaque élément. **Étagères** exigent Zone+Allée+Rayon ; **Niveaux** ajoutent l’Étagère ; **Emplacements** ajoutent le Niveau.', ar: 'التكرار لكل عنصر. **الأرفف** تتطلب المنطقة+الممر+الرف؛ **المستويات** تضيف الرفّ؛ **المواقع** تضيف المستوى.' } },
    ],
  },
  {
    accent: 'border-amber-500', badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', icon: Wand2,
    tag: { fr: 'Méthode 2', ar: 'الطريقة 2' },
    title: { fr: 'Générateur automatique (rapide)', ar: 'المولّد التلقائي (سريع)' },
    intro: { fr: 'Idéal pour **créer toute une allée d’un coup** au démarrage. On indique combien de rayons, d’étagères, de niveaux et d’emplacements, et l’app crée **toute la structure**.', ar: 'مثالي **لإنشاء ممر كامل دفعة واحدة** عند البدء. نحدّد عدد الرفوف والأرفف والمستويات والمواقع، والتطبيق ينشئ **البنية كاملة**.' },
    steps: [
      { path: { fr: 'Magasins › Générateur d’emplacements', ar: 'المتاجر › مولّد المواقع' }, desc: { fr: 'Ouvrir le générateur.', ar: 'فتح المولّد.' } },
      { desc: { fr: 'Choisir le **Dépôt**, la **Zone**, puis l’**Allée** à équiper.', ar: 'اختيار **المستودع**، **المنطقة**، ثم **الممر** المراد تجهيزه.' } },
      { desc: { fr: 'Saisir les quantités : **Rayons**, **Étagères / rayon**, **Niveaux / étagère**, **Emplacements / niveau**.', ar: 'إدخال الكميات: **الرفوف**، **الأرفف/رف**، **المستويات/رفّ**، **المواقع/مستوى**.' } },
      { desc: { fr: 'Vérifier l’**aperçu** : un code exemple et le **nombre total** d’éléments à créer.', ar: 'التحقق من **المعاينة**: رمز مثال و**العدد الإجمالي** للعناصر.' } },
      { path: { fr: 'Bouton « Générer »', ar: 'زر «توليد»' }, desc: { fr: 'Cliquer sur **Générer**. Si l’allée a déjà une structure, choisir **Fusionner** (compléter) ou **Remplacer**.', ar: 'الضغط على **توليد**. إذا كان الممر يحتوي بنية، اختيار **دمج** (إكمال) أو **استبدال**.' } },
      { desc: { fr: '⚠️ Un total très élevé crée **beaucoup de lignes** : générer **allée par allée** plutôt que tout le magasin d’un seul coup.', ar: '⚠️ العدد الكبير جدًا ينشئ **كثيرًا من السطور**: التوليد **ممرًا ممرًا** بدل المتجر كله دفعة واحدة.' } },
    ],
  },
  {
    accent: 'border-emerald-500', badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', icon: Sparkles,
    tag: { fr: 'Raccourcis', ar: 'اختصارات' },
    title: { fr: 'Gagner du temps', ar: 'ربح الوقت' },
    steps: [
      { path: { fr: 'Magasins › Allées › « Allées par défaut »', ar: 'المتاجر › الممرات › «ممرات افتراضية»' }, desc: { fr: 'Crée automatiquement le **modèle AtlasStock** d’allées adapté à la zone choisie.', ar: 'ينشئ تلقائيًا **نموذج AtlasStock** للممرات المناسب للمنطقة المختارة.' } },
      { path: { fr: 'Magasins › Explorateur 3D', ar: 'المتاجر › المستكشف ثلاثي الأبعاد' }, desc: { fr: 'Naviguer **visuellement** de la zone jusqu’à chaque position, ou **rechercher un code** pour voler directement dessus.', ar: 'التنقّل **بصريًا** من المنطقة حتى كل موضع، أو **البحث برمز** للانتقال إليه مباشرة.' } },
      { desc: { fr: '**Export CSV / Excel** : sur chaque niveau, exporter la liste existante (Code, Nom, Emplacement).', ar: '**تصدير CSV / Excel**: في كل مستوى، تصدير القائمة الحالية (الرمز، الاسم، الموقع).' } },
      { desc: { fr: '**Import CSV / Excel** : préparer un fichier (colonne **Code**, colonne **Nom**) et l’importer d’un clic dans le parent sélectionné.', ar: '**استيراد CSV / Excel**: تجهيز ملف (عمود **الرمز**، عمود **الاسم**) واستيراده بنقرة في الأب المحدد.' } },
    ],
  },
  {
    accent: 'border-violet-500', badge: 'bg-violet-500/15 text-violet-600 dark:text-violet-400', icon: Camera,
    tag: { fr: 'Voie rapide', ar: 'المسار السريع' },
    title: { fr: 'Depuis des photos, jusqu’au catalogue rangé', ar: 'من الصور حتى كتالوج مرتّب' },
    intro: { fr: 'La démarche complète pour un magasin neuf : **quelques minutes** au lieu d’une saisie manuelle. Faites-la dans cet ordre — chaque étape a besoin de la précédente.', ar: 'المسار الكامل لمتجر جديد: **بضع دقائق** بدل الإدخال اليدوي. اتبع هذا الترتيب — كل خطوة تحتاج سابقتها.' },
    steps: [
      { path: { fr: 'Produits › Importer', ar: 'المنتجات › استيراد' }, desc: { fr: '**D’abord le catalogue.** Importez vos produits avec une **catégorie correcte** sur chaque article : c’est elle qui décidera de la zone de rangement. Sans catégorie, un produit ne pourra pas être rangé automatiquement.', ar: '**الكتالوج أولًا.** استورد منتجاتك مع **فئة صحيحة** لكل صنف: هي التي تحدد منطقة الترتيب. بدون فئة لا يمكن ترتيب المنتج تلقائيًا.' } },
      { path: { fr: 'Magasins › Magasin depuis photos', ar: 'المتاجر › متجر من الصور' }, desc: { fr: 'Déposez **2 à 6 photos** prises depuis le bout de chaque allée (ou un plan). Une photo large montrant plusieurs rangées vaut mieux qu’un gros plan.', ar: 'أضف **2 إلى 6 صور** مأخوذة من طرف كل ممر (أو مخططًا). صورة واسعة تُظهر عدة صفوف أفضل من لقطة قريبة.' } },
      { desc: { fr: 'À l’écran **Détections**, renommez les zones proposées pour qu’elles **portent exactement le nom de vos catégories** (« Peinture », « Électricité »…). C’est ce qui rendra l’affectation automatique fiable.', ar: 'في شاشة **الاكتشافات**، أعد تسمية المناطق المقترحة لتحمل **نفس أسماء فئاتك** («الطلاء»، «الكهرباء»…). هذا ما يجعل الربط التلقائي دقيقًا.' } },
      { desc: { fr: 'À l’écran **Correction**, ajustez le nombre d’**étagères / niveaux / positions**. Repère utile : *positions ≈ nombre de références que vous voulez loger dans la zone*.', ar: 'في شاشة **التعديل**، اضبط عدد **الأرفف / المستويات / المواضع**. قاعدة مفيدة: *المواضع ≈ عدد المراجع المراد وضعها في المنطقة*.' } },
      { desc: { fr: 'Contrôlez l’**Aperçu 3D**, puis à la **Validation** choisissez « magasin actif » (ou un nouveau magasin) et cliquez **Créer la structure**.', ar: 'راجع **المعاينة ثلاثية الأبعاد**، ثم في **التأكيد** اختر «المتجر النشط» (أو متجرًا جديدًا) واضغط **إنشاء البنية**.' } },
      { path: { fr: 'Magasins › Affecter le catalogue', ar: 'المتاجر › ربط الكتالوج' }, desc: { fr: '**Le maillon final.** Vérifiez la table **catégorie → zone** (corrigez les lignes « Ignorée »), regardez l’aperçu et les **non rangés**, puis **Appliquer le rangement**. Chaque produit reçoit son code d’emplacement.', ar: '**الحلقة الأخيرة.** تحقّق من جدول **الفئة ← المنطقة** (صحّح أسطر «مُتجاهلة»)، راجع المعاينة و**غير المرتبة**، ثم **طبّق الترتيب**. يحصل كل منتج على رمز موقعه.' } },
      { path: { fr: 'Magasins › Rapports › Produits mal localisés', ar: 'المتاجر › التقارير › منتجات بموقع خاطئ' }, desc: { fr: 'Contrôle final : la liste doit être **vide**. Puis imprimez les étiquettes d’emplacement (Magasins › Impression) et collez-les sur les rayonnages.', ar: 'التحقق النهائي: يجب أن تكون القائمة **فارغة**. ثم اطبع ملصقات المواقع (المتاجر › الطباعة) والصقها على الرفوف.' } },
    ],
  },
  {
    accent: 'border-cyan-500', badge: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400', icon: Boxes,
    tag: { fr: 'Au cas par cas', ar: 'حالة بحالة' },
    title: { fr: 'Affecter un produit à un emplacement', ar: 'ربط منتج بموقع' },
    intro: { fr: 'Créer les emplacements ne suffit pas : il faut **y ranger les produits**.', ar: 'إنشاء المواقع لا يكفي: يجب **ترتيب المنتجات فيها**.' },
    steps: [
      { path: { fr: 'Produits › fiche produit › Emplacement', ar: 'المنتجات › بطاقة المنتج › الموقع' }, desc: { fr: 'Choisir Dépôt › Zone › Allée › … › Emplacement pour l’article.', ar: 'اختيار المستودع › المنطقة › الممر › … › الموقع للصنف.' } },
      { path: { fr: 'Magasins › Rangement', ar: 'المتاجر › الترتيب' }, desc: { fr: 'Mode **rangement** (put-away) : scanner un produit puis son emplacement pour l’affecter rapidement.', ar: 'وضع **الترتيب**: مسح المنتج ثم موقعه لربطه بسرعة.' } },
      { path: { fr: 'Magasins › Rapports › Produits mal localisés', ar: 'المتاجر › التقارير › منتجات بموقع خاطئ' }, desc: { fr: 'Contrôler ensuite qu’aucun produit ne pointe vers un emplacement invalide.', ar: 'ثم التحقق من عدم وجود منتج يشير إلى موقع غير صالح.' } },
    ],
  },
]

const TIPS: Bi[] = [
  { fr: 'Numéroter dans l’**ordre physique** où l’on parcourt l’allée (1er rayon = `01`).', ar: 'الترقيم حسب **الترتيب الفعلي** لتصفّح الممر (الرف الأول = `01`).' },
  { fr: 'Garder les codes **courts et réguliers** : 2 chiffres pour rayon/étagère/niveau, 3 pour l’emplacement.', ar: 'إبقاء الرموز **قصيرة ومنتظمة**: رقمان للرف/الرفّ/المستوى، وثلاثة للموقع.' },
  { fr: 'Utiliser le **Générateur** pour la mise en place initiale, puis l’**ajout manuel** pour les retouches.', ar: 'استعمال **المولّد** للتجهيز الأولي، ثم **الإضافة اليدوية** للتعديلات.' },
  { fr: 'Un niveau ne se supprime pas s’il contient des enfants : vider d’abord le contenu.', ar: 'لا يُحذف مستوى يحتوي على عناصر: إفراغ محتواه أولًا.' },
  { fr: 'Coller ensuite l’**étiquette code-barres** de l’emplacement sur l’étagère pour scanner au rangement.', ar: 'لصق **ملصق الباركود** للموقع على الرف للمسح أثناء الترتيب.' },
]

function renderText(txt: string) {
  return txt.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-gray-800 dark:text-zinc-100">{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[12px] text-amber-700 dark:bg-white/10 dark:text-amber-300">{part.slice(1, -1)}</code>
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
            <Layers className="h-6 w-6 text-amber-500" />
            {t('glg_title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('glg_subtitle')}</p>
        </div>
        <button onClick={() => window.print()} className="btn-primary guide-noprint"><Printer className="h-4 w-4" />{t('gx_print')}</button>
      </motion.div>

      {/* Hiérarchie + code */}
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="glass-card p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('glg_hierarchy')}</h2>
        <div className="flex flex-wrap items-stretch gap-2">
          {CHAIN.map((c, i) => (
            <div key={c.code} className="flex items-center gap-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2 text-center dark:border-white/10 dark:bg-white/5">
                <p className="font-mono text-sm font-bold text-amber-600 dark:text-amber-300">{c.code}</p>
                <p className="mt-0.5 text-[12px] font-semibold text-gray-700 dark:text-zinc-200">{c.label[L]}</p>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500">{c.note[L]}</p>
              </div>
              {i < CHAIN.length - 1 && <span className="text-gray-300 dark:text-zinc-600">›</span>}
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 dark:bg-amber-500/10">
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">{t('glg_full_code')} :</span>
          <code className="font-mono text-sm font-bold text-amber-700 dark:text-amber-300">MAG01-DEP01-B-01-R03-E01-N01-P015</code>
        </div>
      </motion.section>

      {/* Règle d'or */}
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
        <p className="text-sm text-gray-700 dark:text-zinc-200">{renderText(t('glg_rule'))}</p>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {SECTIONS.map((sec) => {
          const Icon = sec.icon
          return (
            <motion.section key={sec.title.fr} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
              className={`phase-card glass-card overflow-hidden border-l-4 ${sec.accent}`}>
              <div className="flex items-center gap-3 border-b border-gray-100 p-4 dark:border-white/10 sm:p-5">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${sec.badge}`}><Icon className="h-5 w-5" /></span>
                <div>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${sec.badge}`}>{sec.tag[L]}</span>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white sm:text-lg">{sec.title[L]}</h2>
                </div>
              </div>
              {sec.intro && <p className="border-b border-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-600 dark:border-white/5 dark:text-zinc-300 sm:px-5">{renderText(sec.intro[L])}</p>}
              <ol className="divide-y divide-gray-50 dark:divide-white/5">
                {sec.steps.map((s, i) => (
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
          )
        })}
      </div>

      {/* Bonnes pratiques */}
      <div className="glass-card p-5">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('gx_tips_title')}</h3>
        <ul className="grid gap-2">
          {TIPS.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-zinc-300">
              <span className="font-bold text-amber-500">✓</span>{renderText(tip[L])}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

export default function GuideEmplacementsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
