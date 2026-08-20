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

/** Construit le ZPL d'une étiquette de bon, calibré à la taille (mm) et au dpi donnés. */
export function buildBonZpl(bon: ZplBon, opts: ZplOptions = {}): string {
  const dpi = opts.dpi && opts.dpi > 0 ? opts.dpi : 203
  const dpmm = dpi / 25.4
  const wmm = Math.max(15, opts.widthMm ?? 40)
  const hmm = Math.max(15, opts.heightMm ?? 30)
  const PW = Math.round(wmm * dpmm)
  const LL = Math.round(hmm * dpmm)
  const m = Math.max(8, Math.round(1.4 * dpmm)) // marge gauche
  const show = opts.show ?? {}
  const clientNoLabel = opts.labels?.clientNo ?? 'N CLIENT'

  // Tailles de police proportionnelles à la hauteur d'étiquette.
  const fStore = Math.round(3.2 * dpmm)
  const fName = Math.round(2.7 * dpmm)
  const fSmall = Math.round(2.1 * dpmm)

  const lines: string[] = []
  // Marge haute : en mode continu le contenu tombait un peu trop haut ; on descend d'environ 2 mm.
  let y = Math.round(4 * dpmm)
  const push = (font: number, text: string) => {
    const t = clean(text)
    if (!t) return
    lines.push(`^FO${m},${y}^A0N,${font},${font}^FD${t}^FS`)
    y += font + Math.round(0.6 * dpmm)
  }

  push(fStore, opts.storeName || 'Droguerie Pro')
  push(fName, bon.clientName)
  if (show.phone && bon.clientPhone) push(fSmall, bon.clientPhone)
  push(fSmall, `${clientNoLabel}: ${bon.clientCode || '-'}`)
  if (show.vendeur && bon.vendeurName) push(fSmall, bon.vendeurName)
  if (show.date && bon.date) push(fSmall, fmtDateTime(bon.date))

  // Code-barres Code128 : largeur de module calculée pour tenir dans l'étiquette.
  const modules = 11 * bon.ref.length + 35
  const moduleW = Math.min(4, Math.max(1, Math.floor((PW - 2 * m) / modules)))
  // Hauteur du code-barres : ce qui reste sous le texte, borné.
  const restant = LL - y - Math.round(3 * dpmm)
  const bcH = Math.max(Math.round(6 * dpmm), Math.min(Math.round(7.5 * dpmm), restant))
  const yb = Math.min(y + Math.round(0.5 * dpmm), LL - bcH - Math.round(3 * dpmm))
  lines.push(`^FO${m},${Math.max(y, yb)}^BY${moduleW}^BCN,${bcH},Y,N,N^FD${clean(bon.ref)}^FS`)

  const copies = Math.max(1, opts.copies ?? 1)
  return [
    '^XA',
    '^CI28',
    '^MTD', // thermique direct (GK420d)
    // Mode CONTINU : la détection d'écart (^MNY) sur-avance sur ces étiquettes
    // (capteur qui ne verrouille pas les gaps, même après calibration officielle).
    // En continu l'imprimante avance une longueur FIXE (^LL) et s'arrête net.
    '^MNN',
    '^MMT', // tear-off : recul auto avant impression (meilleur positionnement)
    `^PW${PW}`,
    `^LL${LL}`,
    '^LH0,0',
    ...lines,
    `^PQ${copies}`,
    '^XZ',
  ].join('\n')
}
