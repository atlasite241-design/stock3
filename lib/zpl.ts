// Génération ZPL (Zebra Programming Language) pour l'étiquette d'un bon papier.
//
// Le navigateur ne peut pas envoyer de commandes brutes à une imprimante, et le
// pilote Zebra garde la taille d'étiquette dans une zone privée qu'on ne peut pas
// fixer de façon fiable. On contourne les deux en générant le ZPL nous-mêmes et en
// l'envoyant DIRECTEMENT à l'imprimante via l'API locale /api/print-zebra. Résultat :
// une étiquette calibrée exactement à la taille voulue, sans réglage de pilote.
//
// Fonction PURE (aucune dépendance navigateur) : utilisable côté client comme serveur.

export interface ZplBon {
  ref: string
  clientName: string
  clientCode?: string
  vendeurName?: string
  date?: string
  clientPhone?: string
}

export interface ZplOptions {
  widthMm?: number
  heightMm?: number
  storeName?: string
  dpi?: number
  copies?: number
  /** Écart entre étiquettes (mm). En mode continu, le pas d'avance = hauteur + écart. */
  gapMm?: number
  /** Densité de chauffe (0-30). Plus élevé = plus noir. */
  darkness?: number
  show?: { date?: boolean; vendeur?: boolean; phone?: boolean }
  labels?: { clientNo?: string }
}

// ZPL est sensible à ^ et ~ (préfixes de commande) : on les neutralise dans les données.
const clean = (s: string | undefined): string =>
  (s ?? '').replace(/[\^~]/g, ' ').replace(/[\r\n]+/g, ' ').trim()

const d2 = (n: number) => String(n).padStart(2, '0')
function fmtDateTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d2(d.getDate())}/${d2(d.getMonth() + 1)}/${d.getFullYear()} ${d2(d.getHours())}:${d2(d.getMinutes())}`
}

/**
 * Construit le ZPL d'une étiquette de bon, ADAPTÉ à la taille (mm) et au dpi donnés.
 *
 * Mode CONTINU (^MNN) : la détection d'écart (^MNY) sur-avance sur certaines
 * étiquettes (capteur qui ne verrouille pas les gaps, même après calibration
 * officielle). En continu, l'imprimante avance un pas FIXE (^LL = hauteur + écart)
 * et s'arrête net. La mise en page se calcule à partir de la hauteur pour ne
 * jamais déborder. Taille par défaut : 52 × 31 mm.
 */
export function buildBonZpl(bon: ZplBon, opts: ZplOptions = {}): string {
  const dpi = opts.dpi && opts.dpi > 0 ? opts.dpi : 203
  const dpmm = dpi / 25.4
  const wmm = Math.max(15, opts.widthMm ?? 52)
  const hmm = Math.max(12, opts.heightMm ?? 31)
  const PW = Math.round(wmm * dpmm)
  const LL = Math.round(hmm * dpmm) // hauteur de la zone d'impression (contenu)
  // Pas physique = hauteur + écart entre étiquettes. En mode continu l'imprimante
  // avance ce pas ; trop court → dérive vers le haut ; trop long → vers le bas.
  const feed = Math.round((hmm + (opts.gapMm ?? 2)) * dpmm)
  const darkness = Math.max(0, Math.min(30, Math.round(opts.darkness ?? 22)))
  const m = Math.max(6, Math.round(1.5 * dpmm)) // marge gauche
  const marginB = Math.round(0.8 * dpmm)
  const show = opts.show ?? {}
  const clientNoLabel = opts.labels?.clientNo ?? 'N CLIENT'

  // Lignes de texte au-dessus du code-barres.
  const textLines: string[] = [clean(opts.storeName || 'Droguerie Pro')]
  const codePart = bon.clientCode ? `  ${clientNoLabel}: ${bon.clientCode}` : ''
  textLines.push((clean(bon.clientName) + codePart).trim())
  if (show.phone && bon.clientPhone) textLines.push(clean(bon.clientPhone))
  if (show.vendeur && bon.vendeurName) textLines.push(clean(bon.vendeurName))
  if (show.date && bon.date) textLines.push(fmtDateTime(bon.date))

  // Texte compact en haut (~40 % de la hauteur), code-barres qui remplit le reste.
  const textZone = Math.max(Math.round(3 * dpmm), Math.round(LL * 0.4))
  const n = Math.max(1, textLines.length)
  const font = Math.max(
    Math.round(1.8 * dpmm),
    Math.min(Math.round(2.9 * dpmm), Math.floor(textZone / n) - Math.round(0.4 * dpmm))
  )
  const lineH = font + Math.round(0.5 * dpmm)

  const lines: string[] = []
  let y = Math.round(0.8 * dpmm)
  for (const t of textLines) {
    if (t) lines.push(`^FO${m},${y}^A0N,${font},${font}^FD${t}^FS`)
    y += lineH
  }

  // Code-barres Code128 juste sous le texte, remplissant la hauteur restante.
  const modules = 11 * bon.ref.length + 35
  const moduleW = Math.min(4, Math.max(2, Math.floor((PW - 2 * m) / modules)))
  const yb = y + Math.round(0.6 * dpmm)
  const avail = Math.max(Math.round(6 * dpmm), LL - yb - marginB)
  const barH = Math.round(avail * 0.72) // laisse la place à la ligne de chiffres sous le code
  lines.push(`^FO${m},${yb}^BY${moduleW}^BCN,${barH},Y,N,N^FD${clean(bon.ref)}^FS`)

  const copies = Math.max(1, opts.copies ?? 1)
  return [
    '^XA',
    '^CI28',
    '^MTD', // thermique direct (GK420d)
    `^MD${darkness}`, // densité de chauffe : plus élevé = plus noir
    '^MNN', // mode continu : pas de détection d'écart (capteur non fiable ici)
    '^MMT', // tear-off : recul auto avant impression
    `^PW${PW}`,
    `^LL${feed}`,
    '^LH0,0',
    ...lines,
    `^PQ${copies}`,
    '^XZ',
  ].join('\n')
}
