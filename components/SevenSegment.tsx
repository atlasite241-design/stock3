'use client'

/**
 * Afficheur à sept segments, dessiné en SVG.
 *
 * Pourquoi pas une police ? Une police à segments (DSEG et consorts) suppose
 * un fichier à charger. L'application est une PWA qui doit fonctionner hors
 * ligne : une police servie par un CDN afficherait des chiffres ordinaires le
 * jour où la connexion tombe, et un fichier embarqué pèserait plus lourd que
 * ce composant entier.
 *
 * Le SVG donne aussi ce que la police ne donne pas : les segments ÉTEINTS,
 * visibles en filigrane. C'est ce détail qui fait ressembler l'affichage à un
 * vrai écran plutôt qu'à des chiffres colorés.
 */

/*
 * Segments d'un digit, dans l'ordre conventionnel :
 *
 *      ─ a ─
 *     │     │
 *     f     b
 *     │     │
 *      ─ g ─
 *     │     │
 *     e     c
 *     │     │
 *      ─ d ─
 */
const SEGMENTS: Record<string, string> = {
  a: 'M 4,1  L 16,1  L 14,3.6 L 6,3.6 Z',
  b: 'M 16.6,1.7 L 15.4,12.4 L 13,10.6 L 14,3.2 Z',
  c: 'M 15.2,13.6 L 14,24.3 L 11.7,21.6 L 12.7,14.9 Z',
  d: 'M 1.7,25  L 13.7,25  L 11.3,22.6 L 3.6,22.6 Z',
  e: 'M 3.4,13.6 L 2.2,24.3 L 4.5,21.6 L 5.5,14.9 Z',
  f: 'M 4.6,1.7  L 3.4,12.4 L 5.8,10.6 L 6.8,3.2 Z',
  g: 'M 3,13     L 15,13    L 12.9,11.6 L 5.4,11.6 Z',
}

/** Segments allumés pour chaque caractère affichable. */
const CHIFFRES: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgecd',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  ' ': '',
}

interface DigitProps {
  char: string
  /** Couleur des segments allumés. */
  couleur: string
  /** Opacité des segments éteints — le « fantôme » qui fait l'écran. */
  fantome: number
  taille: number
}

function Digit({ char, couleur, fantome, taille }: DigitProps) {
  const allumes = CHIFFRES[char] ?? ''
  const largeur = (taille * 18) / 26 // rapport hauteur/largeur d'un digit

  return (
    <svg
      width={largeur}
      height={taille}
      viewBox="0 0 18 26"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {Object.entries(SEGMENTS).map(([nom, d]) => {
        const actif = allumes.includes(nom)
        return (
          <path
            key={nom}
            d={d}
            /* Les segments éteints restent visibles, très faiblement : c'est
               ce qui distingue un afficheur d'un simple texte coloré.
               Le remplissage passe par style et non par l'attribut fill : les
               variables CSS — dont la couleur du thème actif — ne sont pas
               substituées dans les attributs de présentation SVG. */
            style={{
              fill: couleur,
              opacity: actif ? 1 : fantome,
              ...(actif ? { filter: `drop-shadow(0 0 ${taille / 12}px ${couleur})` } : {}),
            }}
          />
        )
      })}
    </svg>
  )
}

export interface SevenSegmentProps {
  /** Valeur à afficher. Chiffres, espace et tiret ; le reste passe en texte. */
  value: string | number
  /** Hauteur d'un digit, en pixels. */
  size?: number
  couleur?: string
  /** Opacité des segments éteints. 0 pour les masquer. */
  fantome?: number
  className?: string
}

export default function SevenSegment({
  value,
  size = 22,
  couleur = 'currentColor',
  fantome = 0.12,
  className = '',
}: SevenSegmentProps) {
  const texte = String(value)

  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ gap: size / 9 }}
      /* L'afficheur est décoratif pour un lecteur d'écran : la valeur est
         annoncée une seule fois, en texte, plutôt qu'épelée segment par
         segment. */
      role="img"
      aria-label={texte}
    >
      {texte.split('').map((c, i) =>
        c in CHIFFRES ? (
          <Digit key={i} char={c} couleur={couleur} fantome={fantome} taille={size} />
        ) : (
          /* Les caractères non représentables — « / », « . » — sont rendus en
             texte, à la même hauteur optique. */
          <span
            key={i}
            aria-hidden="true"
            style={{ fontSize: size * 0.62, lineHeight: 1, opacity: 0.55, margin: `0 ${size / 22}px` }}
          >
            {c}
          </span>
        )
      )}
    </span>
  )
}
