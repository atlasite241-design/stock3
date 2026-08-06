/**
 * Recoupement du calculateur de paie Laravel contre le module Next.js EN SERVICE.
 *
 * Les 25 cas de référence du module Laravel ont été produits par une
 * TRANSCRIPTION des formules de lib/hr.ts — fidèle, mais une transcription.
 * Ce script fait tourner le vrai code de production sur les mêmes entrées :
 * si un seul centime diverge, c'est la transcription qui a tort, et le mois
 * de double calcul de la bascule échouerait sans qu'on sache pourquoi.
 *
 *   npx tsx scripts/recoupement-paie.ts
 */
import { computePayslip, RATES_2025 } from '../lib/hr'
import { readFileSync } from 'node:fs'

const FIXTURE = 'C:/Users/BABA/Desktop/droguerie-rh/database/fixtures/payslip_reference_cases.json'

interface Cas {
  nom: string
  entrees: {
    base: number
    primes?: { label: string; amount: number; taxable?: boolean }[]
    avances?: number
    deductions?: { label: string; amount: number }[]
    dependents?: number
  }
  attendu: Record<string, number>
}

// Résultat camelCase du module Next.js → clés snake_case de la fixture.
const CLES: Record<string, string> = {
  brut: 'brut',
  brutImposable: 'brut_imposable',
  cnss: 'cnss',
  amo: 'amo',
  fraisPro: 'frais_pro',
  netImposable: 'net_imposable',
  ir: 'ir',
  net: 'net',
}

const { cas } = JSON.parse(readFileSync(FIXTURE, 'utf-8')) as { cas: Cas[] }

let conformes = 0
let ecarts = 0

for (const c of cas) {
  const r = computePayslip({
    base: c.entrees.base,
    primes: (c.entrees.primes ?? []) as never,
    avances: c.entrees.avances ?? 0,
    deductions: (c.entrees.deductions ?? []) as never,
    dependents: c.entrees.dependents ?? 0,
  })

  for (const [camel, snake] of Object.entries(CLES)) {
    const produit = (r as unknown as Record<string, number>)[camel]
    const attendu = c.attendu[snake]

    if (Math.abs(produit - attendu) < 0.005) {
      conformes++
    } else {
      ecarts++
      console.log(
        `ECART  ${c.nom.padEnd(42)} ${snake.padEnd(15)} nextjs=${produit.toFixed(2)}  laravel=${attendu.toFixed(2)}`
      )
    }
  }
}

console.log()
console.log(`${cas.length} cas x 8 postes : ${conformes} conformes, ${ecarts} ecart(s)`)
console.log(`bareme du module en service : ${RATES_2025.year}`)
console.log(ecarts === 0 ? 'LES DEUX MOTEURS CONCORDENT AU CENTIME' : 'DIVERGENCE : la transcription Laravel a tort')
process.exit(ecarts === 0 ? 0 : 1)
