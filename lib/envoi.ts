/**
 * Envoi d'un document au client, par WhatsApp ou par courriel.
 *
 * Ni l'un ni l'autre n'envoie depuis l'application : on ouvre la conversation
 * ou le brouillon déjà rempli, l'utilisateur relit et envoie. C'est ce qui
 * permet de fonctionner sans serveur d'envoi ni compte tiers — et c'est aussi
 * plus sûr : rien ne part sans qu'on l'ait vu.
 */

/**
 * Normalise un numéro marocain vers le format international attendu par wa.me.
 * « 06 61 00 00 00 » → « 212661000000 ».
 */
export function waNumber(phone: string | undefined): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('212')) return digits
  if (digits.startsWith('0')) return '212' + digits.slice(1)
  return digits
}

/** Lien WhatsApp. Sans numéro, WhatsApp demande à qui envoyer — le message est déjà écrit. */
export function waLink(phone: string | undefined, message: string): string {
  const num = waNumber(phone)
  const txt = encodeURIComponent(message)
  return num ? `https://wa.me/${num}?text=${txt}` : `https://wa.me/?text=${txt}`
}

/**
 * COMPOSER DANS GMAIL plutôt qu'ouvrir un lien `mailto:`.
 *
 * `mailto:` délègue au logiciel de messagerie du poste. Quand aucun n'est
 * associé — le cas courant sur un poste de magasin — le navigateur ouvre un
 * onglet vide et le message est perdu. Gmail s'ouvre dans le navigateur, montre
 * le sélecteur de compte si plusieurs sessions existent, et affiche le
 * brouillon prêt à relire.
 */
export function gmailLink(email: string | undefined, subject: string, body: string): string {
  const p = new URLSearchParams({ view: 'cm', fs: '1', su: subject, body })
  if (email) p.set('to', email)
  return `https://mail.google.com/mail/?${p.toString()}`
}

/** Lien `mailto:` classique — conservé pour qui a un logiciel de messagerie. */
export function mailLink(email: string | undefined, subject: string, body: string): string {
  return `mailto:${email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
