/**
 * Ressources humaines — modèle de données et moteur de paie marocain.
 *
 * Une personne = une fiche. L'identité et le rôle vivent sur le compte
 * applicatif (`users`) ; les données RH vivent ici, dans des collections
 * séparées. Ce n'est PAS une deuxième fiche : c'est une question d'accès.
 * La collection `users` est lisible par toute session (l'écran de connexion en
 * a besoin) — y stocker les salaires, les CIN et les numéros CNSS les rendrait
 * lisibles par n'importe quel caissier. Les collections RH, elles, sont
 * protégées par les permissions `hr.*`.
 */

export type ContractType = 'cdi' | 'cdd' | 'anapec' | 'stage' | 'interim'
export type MaritalStatus = 'celibataire' | 'marie' | 'divorce' | 'veuf'

export interface Employee {
  id: string
  /** Compte applicatif de la personne. C'est le lien qui fait « une seule fiche ». */
  userId: string
  matricule: string
  name: string
  cin?: string
  cnss?: string
  phone?: string
  email?: string
  address?: string
  birthDate?: string
  poste: string
  departement?: string
  hireDate: string
  endDate?: string
  contract: ContractType
  /** Salaire de base mensuel brut, en DH. */
  baseSalary: number
  /** RIB pour le virement. */
  rib?: string
  maritalStatus?: MaritalStatus
  /** Personnes à charge — déduction IR, plafonnée à 6. */
  dependents?: number
  storeId?: string
  active: boolean
  note?: string
}

export interface HrDocument {
  id: string
  employeeId: string
  /** Contrat, CIN, CNSS, diplôme, certificat médical, attestation… */
  type: string
  name: string
  date: string
  expiresAt?: string
  ref?: string
  note?: string
  storeId?: string
}

export type AttendanceStatus = 'present' | 'absent' | 'conge' | 'ferie' | 'repos'

export interface Attendance {
  /** `${employeeId}_${date}` — un seul enregistrement par personne et par jour :
   *  double-pointer ne crée pas de doublon, il complète la même ligne. */
  id: string
  employeeId: string
  date: string // YYYY-MM-DD
  in?: string // HH:MM
  out?: string
  status: AttendanceStatus
  /** Minutes de retard à l'arrivée / de départ anticipé, calculées sur l'horaire. */
  lateMin: number
  earlyMin: number
  /** Minutes réellement travaillées (pause déduite). */
  minutes: number
  shiftId?: string
  note?: string
  storeId?: string
}

export type LeaveType = 'paye' | 'maladie' | 'sans_solde' | 'maternite' | 'paternite' | 'exceptionnel'
export type LeaveStatus = 'demande' | 'approuve' | 'refuse'

export interface Leave {
  id: string
  employeeId: string
  type: LeaveType
  from: string
  to: string
  /** Jours ouvrables décomptés (calculé, mais rectifiable à la main). */
  days: number
  status: LeaveStatus
  reason?: string
  decidedBy?: string
  decidedAt?: string
  storeId?: string
}

export interface Shift {
  id: string
  name: string
  start: string // HH:MM
  end: string
  breakMin: number
  /** Jours travaillés : 0 = dimanche … 6 = samedi. */
  days: number[]
  /** Tolérance avant qu'une arrivée compte comme un retard. */
  graceMin: number
  storeId?: string
}

export interface Team {
  id: string
  name: string
  shiftId?: string
  leaderId?: string
  memberIds: string[]
  color?: string
  storeId?: string
}

export interface Holiday {
  id: string
  date: string // YYYY-MM-DD
  name: string
  nameAr?: string
  /** Fête à date fixe (1er janvier, Fête du Travail…) : se répète chaque année. */
  fixed?: boolean
}

export type AdjustmentKind = 'prime' | 'avance' | 'deduction'

export interface PayAdjustment {
  id: string
  employeeId: string
  kind: AdjustmentKind
  label: string
  amount: number
  date: string
  /** Bulletin de rattachement, au format YYYY-MM. */
  period: string
  /** Prime soumise à cotisations et à l'IR. Les indemnités de panier, de
   *  transport et de salissure en sont exonérées dans certaines limites. */
  taxable?: boolean
  note?: string
  storeId?: string
}

export interface PayslipLine {
  label: string
  amount: number
  taxable?: boolean
}

export interface Payslip {
  id: string
  employeeId: string
  period: string // YYYY-MM
  base: number
  primes: PayslipLine[]
  /** Brut imposable retenu pour le calcul (base + primes imposables). */
  brutImposable: number
  brut: number
  cnss: number
  amo: number
  fraisPro: number
  netImposable: number
  ir: number
  avances: number
  deductions: PayslipLine[]
  net: number
  daysWorked?: number
  daysAbsent?: number
  issuedAt: string
  /** Barème appliqué — figé au moment de l'émission (les taux changent). */
  rates: PayrollRates
  storeId?: string
}

export interface Evaluation {
  id: string
  employeeId: string
  period: string
  scores: Record<string, number>
  average: number
  comment?: string
  by?: string
  date: string
  storeId?: string
}

export interface Objective {
  id: string
  employeeId: string
  title: string
  target: number
  unit?: string
  progress: number
  from: string
  deadline?: string
  status: 'en_cours' | 'atteint' | 'manque'
  storeId?: string
}

export interface HrAction {
  id: string
  employeeId: string
  kind: 'recompense' | 'sanction'
  /** Avertissement verbal / écrit, mise à pied, prime exceptionnelle, félicitations… */
  type: string
  label: string
  date: string
  amount?: number
  note?: string
  by?: string
  storeId?: string
}

export interface Training {
  id: string
  title: string
  org?: string
  from: string
  to?: string
  cost?: number
  participantIds: string[]
  status: 'planifiee' | 'en_cours' | 'terminee' | 'annulee'
  note?: string
  storeId?: string
}

export interface Skill {
  id: string
  employeeId: string
  name: string
  /** 1 = notion, 2 = pratique, 3 = autonome, 4 = référent. */
  level: 1 | 2 | 3 | 4
  note?: string
  storeId?: string
}

export interface Certification {
  id: string
  employeeId: string
  name: string
  issuer?: string
  issuedAt: string
  expiresAt?: string
  ref?: string
  storeId?: string
}

export interface JobOffer {
  id: string
  title: string
  poste: string
  contract: ContractType
  openings: number
  salaryFrom?: number
  salaryTo?: number
  publishedAt: string
  closesAt?: string
  status: 'ouverte' | 'fermee'
  description?: string
  storeId?: string
}

export interface Interview {
  date: string
  by?: string
  score?: number
  note?: string
}

export type ApplicationStatus = 'recue' | 'preselection' | 'entretien' | 'retenue' | 'refusee' | 'embauchee'

export interface Application {
  id: string
  jobId?: string
  name: string
  phone?: string
  email?: string
  cvNote?: string
  appliedAt: string
  status: ApplicationStatus
  interviews: Interview[]
  /** Renseigné quand la candidature est convertie en employé. */
  hiredEmployeeId?: string
  hiredAt?: string
  storeId?: string
}

export interface Badge {
  id: string
  employeeId: string
  code: string
  issuedAt: string
  active: boolean
  note?: string
  storeId?: string
}

/* ────────────────────────────  Paie marocaine  ──────────────────────────── */

/**
 * Taux et barème. Ils changent à chaque loi de finances : ils sont FIGÉS dans
 * chaque bulletin émis (`Payslip.rates`), pour qu'un recalcul ultérieur ne
 * réécrive pas silencieusement un bulletin déjà remis à l'employé.
 */
export interface PayrollRates {
  /** Millésime du barème, affiché sur le bulletin. */
  year: number
  cnssRate: number
  cnssCeiling: number
  amoRate: number
  /** Frais professionnels : taux et plafond mensuel, selon le brut annuel. */
  fpLowRate: number
  fpLowCap: number
  fpHighRate: number
  fpHighCap: number
  fpThresholdAnnual: number
  /** Barème IR mensuel : seuil bas inclus, taux, somme à déduire. */
  irBrackets: { upTo: number; rate: number; deduct: number }[]
  /** Déduction mensuelle par personne à charge, et nombre maximum retenu. */
  dependentRelief: number
  dependentMax: number
}

/**
 * Barème 2025 (loi de finances 2025).
 * Tranches IR annuelles : 0–40 000 exonéré, puis 10 / 20 / 30 / 34 / 37 %.
 * Charges de famille portées à 500 DH par personne et par an (6 au plus).
 */
export const RATES_2025: PayrollRates = {
  year: 2025,
  cnssRate: 0.0448,
  cnssCeiling: 6000,
  amoRate: 0.0226,
  fpLowRate: 0.35,
  fpLowCap: 2500, // 30 000 DH / an
  fpHighRate: 0.25,
  fpHighCap: 2916.67, // 35 000 DH / an
  fpThresholdAnnual: 78000,
  irBrackets: [
    { upTo: 3333.33, rate: 0, deduct: 0 },
    { upTo: 5000, rate: 0.1, deduct: 333.33 },
    { upTo: 6666.67, rate: 0.2, deduct: 833.33 },
    { upTo: 8333.33, rate: 0.3, deduct: 1500 },
    { upTo: 15000, rate: 0.34, deduct: 1833.33 },
    { upTo: Infinity, rate: 0.37, deduct: 2283.33 },
  ],
  dependentRelief: 41.67, // 500 DH / an
  dependentMax: 6,
}

export const round2 = (n: number) => Math.round(n * 100) / 100

/** Cotisation CNSS salariale — assise plafonnée. */
export function cnssOf(brutImposable: number, r: PayrollRates = RATES_2025): number {
  return round2(Math.min(brutImposable, r.cnssCeiling) * r.cnssRate)
}

/** Cotisation AMO salariale — pas de plafond. */
export function amoOf(brutImposable: number, r: PayrollRates = RATES_2025): number {
  return round2(brutImposable * r.amoRate)
}

/** Frais professionnels : le taux dépend du brut ANNUEL, le plafond est mensuel. */
export function fraisProOf(brutImposable: number, r: PayrollRates = RATES_2025): number {
  const annual = brutImposable * 12
  const [rate, cap] = annual <= r.fpThresholdAnnual ? [r.fpLowRate, r.fpLowCap] : [r.fpHighRate, r.fpHighCap]
  return round2(Math.min(brutImposable * rate, cap))
}

/** IR mensuel par tranche, diminué des charges de famille. Jamais négatif. */
export function irOf(netImposable: number, dependents = 0, r: PayrollRates = RATES_2025): number {
  const b = r.irBrackets.find((x) => netImposable <= x.upTo) ?? r.irBrackets[r.irBrackets.length - 1]
  const brut = netImposable * b.rate - b.deduct
  const relief = Math.min(dependents, r.dependentMax) * r.dependentRelief
  return round2(Math.max(0, brut - relief))
}

export interface PayslipInput {
  base: number
  primes: PayslipLine[]
  avances: number
  deductions: PayslipLine[]
  dependents?: number
  daysWorked?: number
  daysAbsent?: number
}

/**
 * Calcul complet d'un bulletin.
 *
 * Enchaînement : brut imposable → CNSS + AMO → frais professionnels →
 * net imposable → IR → net à payer. Les primes non imposables (panier,
 * transport) entrent dans le brut versé mais pas dans l'assiette.
 */
export function computePayslip(input: PayslipInput, r: PayrollRates = RATES_2025) {
  const primes = input.primes ?? []
  const primesTaxable = primes.filter((p) => p.taxable !== false).reduce((a, p) => a + p.amount, 0)
  const primesExempt = primes.filter((p) => p.taxable === false).reduce((a, p) => a + p.amount, 0)

  const brutImposable = round2(input.base + primesTaxable)
  const brut = round2(brutImposable + primesExempt)

  const cnss = cnssOf(brutImposable, r)
  const amo = amoOf(brutImposable, r)
  const fraisPro = fraisProOf(brutImposable, r)
  const netImposable = round2(Math.max(0, brutImposable - fraisPro - cnss - amo))
  const ir = irOf(netImposable, input.dependents ?? 0, r)

  const deductions = input.deductions ?? []
  const autres = deductions.reduce((a, d) => a + d.amount, 0)
  const net = round2(brut - cnss - amo - ir - (input.avances || 0) - autres)

  return { brut, brutImposable, cnss, amo, fraisPro, netImposable, ir, net, primes, deductions }
}

/* ─────────────────────────────  Utilitaires  ───────────────────────────── */

export const HR_CONTRACTS: { value: ContractType; fr: string; ar: string }[] = [
  { value: 'cdi', fr: 'CDI', ar: 'عقد غير محدد المدة' },
  { value: 'cdd', fr: 'CDD', ar: 'عقد محدد المدة' },
  { value: 'anapec', fr: 'Contrat ANAPEC', ar: 'عقد أنابيك' },
  { value: 'stage', fr: 'Stage', ar: 'تدريب' },
  { value: 'interim', fr: 'Intérim', ar: 'عمل مؤقت' },
]

export const LEAVE_TYPES: { value: LeaveType; fr: string; ar: string }[] = [
  { value: 'paye', fr: 'Congé payé', ar: 'عطلة مؤدى عنها' },
  { value: 'maladie', fr: 'Maladie', ar: 'مرض' },
  { value: 'sans_solde', fr: 'Sans solde', ar: 'بدون أجر' },
  { value: 'maternite', fr: 'Maternité', ar: 'أمومة' },
  { value: 'paternite', fr: 'Paternité', ar: 'أبوة' },
  { value: 'exceptionnel', fr: 'Exceptionnel', ar: 'استثنائية' },
]

/** Jours fériés marocains à date fixe. Les fêtes religieuses suivent le calendrier
 *  hégirien : elles se saisissent chaque année, on ne peut pas les figer ici. */
export const MA_FIXED_HOLIDAYS: { md: string; fr: string; ar: string }[] = [
  { md: '01-01', fr: "Nouvel an", ar: 'رأس السنة الميلادية' },
  { md: '01-11', fr: "Manifeste de l'indépendance", ar: 'ذكرى تقديم وثيقة الاستقلال' },
  { md: '01-14', fr: 'Nouvel an amazigh', ar: 'رأس السنة الأمازيغية' },
  { md: '05-01', fr: 'Fête du Travail', ar: 'عيد الشغل' },
  { md: '07-30', fr: 'Fête du Trône', ar: 'عيد العرش' },
  { md: '08-14', fr: 'Oued Eddahab', ar: 'ذكرى استرجاع وادي الذهب' },
  { md: '08-20', fr: 'Révolution du Roi et du Peuple', ar: 'ثورة الملك والشعب' },
  { md: '08-21', fr: 'Fête de la Jeunesse', ar: 'عيد الشباب' },
  { md: '11-06', fr: 'Marche Verte', ar: 'المسيرة الخضراء' },
  { md: '11-18', fr: "Fête de l'Indépendance", ar: 'عيد الاستقلال' },
]

/** Minutes entre deux heures « HH:MM ». Négatif si l'ordre est inversé. */
export function minutesBetween(from: string, to: string): number {
  const [h1, m1] = from.split(':').map(Number)
  const [h2, m2] = to.split(':').map(Number)
  if ([h1, m1, h2, m2].some((n) => Number.isNaN(n))) return 0
  return h2 * 60 + m2 - (h1 * 60 + m1)
}

export const fmtHours = (minutes: number): string => {
  const sign = minutes < 0 ? '-' : ''
  const m = Math.abs(Math.round(minutes))
  return `${sign}${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

/** Jours ouvrables entre deux dates incluses (samedi compté, dimanche exclu —
 *  usage courant dans le commerce de détail marocain). */
export function workingDays(from: string, to: string): number {
  const a = new Date(from)
  const b = new Date(to)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0
  let n = 0
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0) n++
  }
  return n
}

export const periodOf = (iso: string) => iso.slice(0, 7)
export const todayISO = () => new Date().toISOString().slice(0, 10)
export const monthLabel = (period: string, lang: 'fr' | 'ar' = 'fr') => {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return period
  return new Date(y, m - 1, 1).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { month: 'long', year: 'numeric' })
}
