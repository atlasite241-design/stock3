'use client'

import { Briefcase, CalendarDays, CreditCard, Mail, MapPin, Phone, User } from 'lucide-react'
import { fmtDH, useDroguerie, type Settings } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

/*
 * DOCUMENT COMMERCIAL (facture, avoir, bon de commande, relevé…).
 *
 * Un seul gabarit pour six écrans : ce qui change d'un document à l'autre passe
 * par les propriétés, jamais par une copie du fichier.
 *
 * Les couleurs sont posées en STYLE INLINE et non par classes : la feuille
 * d'impression du site force le noir sur blanc pour tout `.print-area`, et le
 * PDF est produit par capture de l'écran — l'inline est ce qui survit aux deux.
 */
const ACCENT = '#e8621a'
const ACCENT_PALE = '#fdece2'
const ENCRE = '#1f2937'
const GRIS = '#6b7280'
const TRAIT = '#e5e7eb'

/*
 * ÉCHELLE DU DOCUMENT. Les tailles ci-dessous décrivent la maquette d'origine ;
 * ce facteur les agrandit d'un seul geste. Le premier rendu tenait dans le
 * tiers supérieur d'une A4 en corps minuscule : lisible à l'écran, étriqué une
 * fois imprimé. Régler cette valeur suffit à respirer davantage ou à faire
 * tenir un document très long.
 */
const ECHELLE = 1.22
const s = (n: number) => Math.round(n * ECHELLE * 10) / 10

export interface DocLine {
  label: string
  qty: number
  unit?: string
  puHT: number
  tvaPct: number
  /** Code emplacement (WMS) — affiché sur les bons de préparation/livraison. */
  emplacement?: string
  /** Référence article (code-barres, SKU). La colonne n'apparaît que si au moins une ligne en a une. */
  ref?: string
  /** Remise de ligne déjà DÉDUITE de puHT ; affichée pour information. */
  remisePct?: number
}

// --- Montant en toutes lettres (français, dirhams + centimes) ---
const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const T = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', '', 'quatre-vingt', '']

function below100(n: number): string {
  if (n < 20) return U[n]
  const t = Math.floor(n / 10)
  const u = n % 10
  if (t === 7) return u === 1 ? 'soixante et onze' : 'soixante-' + U[10 + u]
  if (t === 9) return 'quatre-vingt-' + U[10 + u]
  let w = T[t]
  if (t === 8 && u === 0) w = 'quatre-vingts'
  if (u === 0) return w
  if (u === 1 && t >= 2 && t <= 6) return w + ' et un'
  return w + '-' + U[u]
}

function below1000(n: number): string {
  if (n === 0) return ''
  const h = Math.floor(n / 100)
  const r = n % 100
  let s = ''
  if (h > 0) {
    s = h === 1 ? 'cent' : U[h] + ' cent'
    if (r === 0 && h > 1) s += 's'
  }
  if (r > 0) s = (s ? s + ' ' : '') + below100(r)
  return s
}

function frenchWords(n: number): string {
  if (n === 0) return 'zéro'
  const mil = Math.floor(n / 1_000_000)
  const th = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  const parts: string[] = []
  if (mil > 0) parts.push(mil === 1 ? 'un million' : below1000(mil) + ' millions')
  if (th > 0) parts.push(th === 1 ? 'mille' : below1000(th) + ' mille')
  if (rest > 0) parts.push(below1000(rest))
  return parts.join(' ')
}

export function montantEnLettres(amount: number): string {
  const safe = Math.max(0, amount || 0)
  const dh = Math.floor(safe + 1e-9)
  const cents = Math.round((safe - dh) * 100)
  let s = `${frenchWords(dh)} ${dh <= 1 ? 'dirham' : 'dirhams'}`
  if (cents > 0) s += ` et ${frenchWords(cents)} ${cents <= 1 ? 'centime' : 'centimes'}`
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function InvoiceDocument({
  title,
  number,
  docNumber,
  date,
  partyLabel,
  partyName,
  partyAddress,
  partyLegal,
  contact,
  lines,
  paid,
  showBalance = false,
  showEmplacement = false,
  settingsOverride,
  infos,
  observations,
  showAmountInWords = true,
}: {
  title: string
  number?: string
  docNumber?: string
  date: string
  partyLabel: string
  partyName: string
  partyAddress?: string
  /** Mentions légales du destinataire (ICE, IF…), sous son adresse. */
  partyLegal?: string
  /** Interlocuteur chez le destinataire — la case CONTACT n'apparaît que s'il y en a un. */
  contact?: { name?: string; phone?: string; email?: string }
  lines: DocLine[]
  paid?: number
  showBalance?: boolean
  showEmplacement?: boolean
  settingsOverride?: Settings
  /**
   * Bandeau de conditions, sous l'en-tête : échéance, règlement, référence…
   * Les valeurs vides sont ignorées, le bandeau disparaît s'il ne reste rien —
   * un document commercial ne montre pas de cases à trous.
   */
  infos?: { label: string; value?: string | null }[]
  /** Remarques libres, en bas à gauche, à côté des conditions de vente. */
  observations?: string
  /**
   * « Arrêté la présente facture à la somme de… » — mention légale des
   * documents de VENTE. Un bon de commande n'arrête aucune facture : il
   * demande une livraison. À `false` sur les documents d'achat.
   */
  showAmountInWords?: boolean
}) {
  const { settings: storeSettings } = useDroguerie()
  // Les factures/documents utilisent TOUJOURS les coordonnées de la Société
  // (Paramètres › Société) — source unique. Un override explicite (aperçu en
  // direct) l'emporte.
  const settings: Settings = settingsOverride ?? storeSettings
  const { t } = useLanguage()

  const totalHT = lines.reduce((a, l) => a + l.puHT * l.qty, 0)
  const totalTVA = lines.reduce((a, l) => a + l.puHT * l.qty * (l.tvaPct / 100), 0)
  const totalTTC = totalHT + totalTVA
  // Remise déjà déduite des prix : on la RESTITUE pour l'afficher, sinon le
  // client ne voit jamais l'effort consenti.
  const totalRemise = lines.reduce((a, l) => {
    const pct = l.remisePct ?? 0
    if (pct <= 0 || pct >= 100) return a
    const avant = (l.puHT / (1 - pct / 100)) * l.qty
    return a + (avant - l.puHT * l.qty)
  }, 0)

  const dateStr = new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const avecRef = lines.some((l) => l.ref)
  const avecRemise = lines.some((l) => (l.remisePct ?? 0) > 0)

  const legalBits = [
    settings.ice && `ICE : ${settings.ice}`,
    settings.idFiscal && `IF : ${settings.idFiscal}`,
    settings.rcNo && `RC : ${settings.rcNo}`,
    settings.taxePro && `Patente : ${settings.taxePro}`,
    settings.cnss && `CNSS : ${settings.cnss}`,
  ].filter(Boolean)

  const infosRemplies = (infos ?? []).filter((i) => i.value)
  const ICONES = [CalendarDays, CreditCard, User, Briefcase]

  const th: React.CSSProperties = { padding: '7px 8px', color: '#fff', fontWeight: 700, fontSize: s(10), letterSpacing: '.03em' }
  const td: React.CSSProperties = { padding: '7px 8px', borderBottom: `1px solid ${TRAIT}`, fontSize: s(11.5) }

  return (
    /*
     * LARGEUR FIXE — 794 px, soit une A4 à 96 ppp.
     *
     * Le document héritait de la largeur de son conteneur : large dans l'aperçu
     * des réglages, étroit dans une fenêtre modale. Après l'agrandissement du
     * corps, cette largeur variable a fait déborder le texte — nom de société
     * coupé en deux, libellés tronqués, montants renvoyés à la ligne — alors
     * que le même document restait impeccable ailleurs.
     *
     * En figeant la largeur, la mise en page ne dépend plus de l'écran qui
     * l'affiche : l'aperçu, le PDF et l'impression montrent EXACTEMENT la même
     * chose. Les conteneurs trop étroits font défiler, ils ne compriment plus.
     */
    <div
      className="print-area invoice-print bg-white p-7"
      style={{ colorScheme: 'light', color: ENCRE, fontSize: s(12), width: 794, boxSizing: 'border-box' }}
    >
      {/* ---------- En-tête : émetteur à gauche, document à droite ---------- */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
          {settings.logoDataUrl ? (
            <img src={settings.logoDataUrl} alt="" style={{ height: s(58), width: s(58), objectFit: 'contain' }} />
          ) : (
            <div style={{ height: s(58), width: s(58), borderRadius: 6, background: ACCENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: s(20) }}>
              {(settings.storeName || 'DP').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            {/* Le nom ne se casse pas en deux : « AQAQIR AOULAD AL / BAKALI »
                est une raison sociale mutilée, pas une mise en page. */}
            <p style={{ margin: 0, fontSize: s(21), fontWeight: 900, letterSpacing: '-.02em', color: ACCENT, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
              {settings.storeName}
            </p>
            {settings.slogan && <p style={{ margin: '2px 0 0', fontSize: s(10), color: GRIS }}>{settings.slogan}</p>}
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2, fontSize: s(10), color: ENCRE }}>
              {settings.address && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin style={{ height: 11, width: 11, color: ACCENT, flexShrink: 0 }} />{settings.address}
                </span>
              )}
              {settings.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Phone style={{ height: 11, width: 11, color: ACCENT, flexShrink: 0 }} />{settings.phone}
                </span>
              )}
              {settings.email && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Mail style={{ height: 11, width: 11, color: ACCENT, flexShrink: 0 }} />{settings.email}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: s(30), fontWeight: 900, letterSpacing: '-.02em', color: ACCENT, lineHeight: 1 }}>
            {title}
          </p>
          {(number || docNumber) && (
            <p style={{ margin: '6px 0 0', fontSize: s(12), fontWeight: 700 }}>
              {t('fdoc_number')} {number ?? docNumber}
            </p>
          )}
          <p style={{ margin: '2px 0 0', fontSize: s(11), color: GRIS }}>{dateStr}</p>
        </div>
      </div>

      <div style={{ height: 3, background: ACCENT, margin: '14px 0 0', borderRadius: 2 }} />

      {/* ---------- Bandeau des conditions ---------- */}
      {infosRemplies.length > 0 && (
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: `repeat(${infosRemplies.length}, minmax(0,1fr))`, gap: 8 }}>
          {infosRemplies.map((i, idx) => {
            const Icone = ICONES[idx % ICONES.length]
            return (
              <div key={idx} style={{ border: `1px solid ${TRAIT}`, borderRadius: 6, padding: '7px 9px', minWidth: 0 }}>
                {/* Le libellé tient sur une ligne, en entier : la largeur fixe
                    du document lui garantit la place. Le tronquer donnait
                    « MODE DE RÈGLEMI » — pire que le passage à la ligne. */}
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: s(8.5), fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '.02em', whiteSpace: 'nowrap' }}>
                  <Icone style={{ height: 11, width: 11, flexShrink: 0 }} />
                  {i.label}
                </span>
                <p style={{ margin: '3px 0 0', fontSize: s(11), fontWeight: 600 }}>{i.value}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ---------- Destinataire (+ contact s'il existe) ---------- */}
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: contact ? '1fr 1fr' : '1fr', gap: 10 }}>
        <div style={{ border: `1px solid ${TRAIT}`, borderRadius: 6, padding: '9px 11px' }}>
          <p style={{ margin: 0, fontSize: s(9), fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '.06em' }}>{partyLabel}</p>
          <p style={{ margin: '3px 0 0', fontSize: s(13), fontWeight: 700 }}>{partyName}</p>
          {partyAddress && <p style={{ margin: '2px 0 0', fontSize: s(10.5), color: GRIS }}>{partyAddress}</p>}
          {partyLegal && <p style={{ margin: '2px 0 0', fontSize: s(10.5), color: GRIS }}>{partyLegal}</p>}
        </div>
        {contact && (
          <div style={{ border: `1px solid ${TRAIT}`, borderRadius: 6, padding: '9px 11px' }}>
            <p style={{ margin: 0, fontSize: s(9), fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('fdoc_contact')}</p>
            {contact.name && <p style={{ margin: '3px 0 0', fontSize: s(11.5), fontWeight: 600 }}>{contact.name}</p>}
            {contact.phone && <p style={{ margin: '2px 0 0', fontSize: s(10.5), color: GRIS }}>{t('fdoc_phone')} : {contact.phone}</p>}
            {contact.email && <p style={{ margin: '2px 0 0', fontSize: s(10.5), color: GRIS }}>{t('fdoc_email')} : {contact.email}</p>}
          </div>
        )}
      </div>

      {/* ---------- Lignes ---------- */}
      <table style={{ marginTop: 12, width: '100%', borderCollapse: 'collapse', overflow: 'hidden', borderRadius: 6 }}>
        <thead>
          <tr style={{ background: ACCENT }}>
            {avecRef && <th style={{ ...th, textAlign: 'left' }}>{t('fdoc_col_ref')}</th>}
            <th style={{ ...th, textAlign: 'left' }}>{t('fdoc_col_products')}</th>
            {showEmplacement && <th style={{ ...th, textAlign: 'left' }}>{t('wms_emplacement')}</th>}
            <th style={{ ...th, textAlign: 'center' }}>{t('fdoc_col_qty')}</th>
            <th style={{ ...th, textAlign: 'right' }}>{t('fdoc_col_pu_ht')}</th>
            {avecRemise && <th style={{ ...th, textAlign: 'center' }}>{t('fdoc_col_remise')}</th>}
            <th style={{ ...th, textAlign: 'center' }}>{t('fdoc_col_tva')}</th>
            <th style={{ ...th, textAlign: 'right' }}>{t('fdoc_col_total_ttc')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, idx) => (
            <tr key={idx} style={{ background: idx % 2 ? '#fafafa' : '#fff' }}>
              {avecRef && <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: s(10.5), color: GRIS }}>{l.ref || '—'}</td>}
              <td style={{ ...td, fontWeight: 600 }}>
                {l.label}
                {l.unit && <span style={{ color: GRIS, fontWeight: 400 }}> · {l.unit}</span>}
              </td>
              {showEmplacement && <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: s(10.5), color: GRIS }}>{l.emplacement || '—'}</td>}
              <td style={{ ...td, textAlign: 'center' }}>{l.qty}</td>
              <td style={{ ...td, textAlign: 'right' }}>{fmtDH(l.puHT)}</td>
              {avecRemise && <td style={{ ...td, textAlign: 'center' }}>{(l.remisePct ?? 0).toFixed(2).replace('.', ',')} %</td>}
              <td style={{ ...td, textAlign: 'center' }}>{l.tvaPct.toFixed(0)} %</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtDH(l.puHT * l.qty * (1 + l.tvaPct / 100))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---------- Observations / conditions + totaux ---------- */}
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, alignItems: 'start' }}>
        <div style={{ fontSize: s(10.5), lineHeight: 1.5 }}>
          {observations && (
            <>
              <p style={{ margin: 0, fontSize: s(9), fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('fdoc_observations')}</p>
              <p style={{ margin: '3px 0 10px', color: ENCRE, whiteSpace: 'pre-line' }}>{observations}</p>
            </>
          )}
          {settings.invoiceTerms && (
            <>
              <p style={{ margin: 0, fontSize: s(9), fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('fdoc_conditions')}</p>
              <p style={{ margin: '3px 0 0', color: GRIS, whiteSpace: 'pre-line' }}>{settings.invoiceTerms}</p>
            </>
          )}
        </div>

        <div style={{ border: `1px solid ${TRAIT}`, borderRadius: 6, overflow: 'hidden' }}>
          <Ligne label={t('fdoc_total_ht')} valeur={fmtDH(totalHT)} />
          {totalRemise > 0 && <Ligne label={t('fdoc_col_remise')} valeur={`− ${fmtDH(totalRemise)}`} />}
          <Ligne label={`${t('fdoc_total_tva')}`} valeur={fmtDH(totalTVA)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 11px', background: ACCENT_PALE }}>
            <span style={{ fontSize: s(11), fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '.04em' }}>{t('fdoc_total_ttc')}</span>
            <span style={{ fontSize: s(15), fontWeight: 900, color: ACCENT }}>{fmtDH(totalTTC)}</span>
          </div>
          {paid !== undefined && <Ligne label={t('fdoc_paid')} valeur={fmtDH(paid)} />}
          {showBalance && paid !== undefined && (
            <Ligne label={t('fdoc_remaining')} valeur={fmtDH(Math.max(0, totalTTC - paid))} fort />
          )}
        </div>
      </div>

      {/* ---------- Montant en lettres + cachet ---------- */}
      <div className="invoice-signature" style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16, alignItems: 'stretch' }}>
        <div style={{ border: `1px solid ${TRAIT}`, borderRadius: 6, padding: '9px 11px' }}>
          {showAmountInWords && (
            <>
              <p style={{ margin: 0, fontSize: s(9), fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('fdoc_amount_words')}</p>
              <p style={{ margin: '3px 0 0', fontSize: s(11.5), fontWeight: 700 }}>{montantEnLettres(totalTTC)}.</p>
            </>
          )}
        </div>
        <div style={{ border: `1px solid ${TRAIT}`, borderRadius: 6, padding: '6px 9px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: s(9), fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '.04em' }}>{t('fdoc_stamp')}</p>
          {settings.signatureDataUrl
            ? <img src={settings.signatureDataUrl} alt="" style={{ margin: '2px auto 0', height: 52, objectFit: 'contain' }} />
            : <div style={{ height: 52 }} />}
        </div>
      </div>

      {/* ---------- Pied ---------- */}
      {/*
       * Les mentions légales occupent TOUTE la largeur, la formule de courtoisie
       * passe en dessous. Côte à côte, la courtoisie rognait la place et le pied
       * cassait « Patente : » de son numéro — une mention légale scindée en deux
       * ne vaut plus rien. Chaque mention reste en outre d'un seul tenant.
       */}
      <div className="invoice-footer" style={{ marginTop: 14, paddingTop: 8, borderTop: `2px solid ${ACCENT}`, fontSize: s(8.5), color: GRIS }}>
        <p style={{ margin: 0 }}>
          <b style={{ color: ENCRE, whiteSpace: 'nowrap' }}>{settings.storeName}</b>
          {legalBits.map((m) => (
            <span key={String(m)} style={{ whiteSpace: 'nowrap' }}> · {m}</span>
          ))}
        </p>
        <p style={{ margin: '3px 0 0', fontStyle: 'italic', textAlign: 'right' }}>{t('fdoc_thanks')}</p>
      </div>
    </div>
  )
}

function Ligne({ label, valeur, fort }: { label: string; valeur: string; fort?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 11px', borderBottom: `1px solid ${TRAIT}`, fontSize: s(11) }}>
      <span style={{ color: GRIS, fontWeight: 600 }}>{label}</span>
      <span style={{ fontWeight: fort ? 800 : 600, color: ENCRE }}>{valeur}</span>
    </div>
  )
}
