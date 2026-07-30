// Palette « entrepôt réel » partagée par les vues 3D.
// Référence : rayonnages métalliques peints (montants bleus, tablettes claires),
// plaques de repérage jaunes en tête d'allée, sol béton.

export const MAT = {
  /** Montants et joues d'échelle — bleu RAL 5010 approché. */
  upright: '#1a56a8',
  uprightDark: '#123f7d',
  /** Tablettes / plateaux — tôle galvanisée claire. */
  shelf: '#c3cad4',
  shelfEdge: '#8f9aa8',
  /** Sol béton lissé. */
  floor: '#23262c',
  /** Plaque de repérage d'allée (fond jaune, texte noir). */
  sign: '#f5c518',
  /** Couleurs de cartons / bacs posés sur les tablettes. */
  cartons: ['#c0562f', '#d97706', '#a3541f', '#b91c1c', '#4b5563', '#1f6f5c'],
} as const

/** Carton déterministe pour un index donné (pas de scintillement au rendu). */
export const cartonColor = (i: number) => MAT.cartons[i % MAT.cartons.length]
