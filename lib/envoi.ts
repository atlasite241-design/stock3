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

export function mailLink(email: string | undefined, subject: string, body: string): string {
  return `mailto:${email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
