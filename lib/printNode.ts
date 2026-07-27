/**
 * Imprime UNIQUEMENT un élément du DOM dans un iframe isolé.
 *
 * Pourquoi : `window.print()` sur une modale laisse le reste de l'app (masqué
 * mais toujours dans le flux) occuper la hauteur de la page → pages blanches
 * en trop, et le navigateur ajoute ses en-têtes/pieds (date, URL, n° de page).
 * En n'imprimant qu'un document autonome (marge de page 0), on évite les deux.
 *
 * Les feuilles de styles de la page (Tailwind + globals, dont les règles
 * `@media print`) sont copiées dans l'iframe pour conserver la mise en page.
 */
export function printNode(el: HTMLElement | null) {
  if (!el || typeof window === 'undefined') return

  const heads = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((n) => n.outerHTML)
    .join('\n')

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
  document.body.appendChild(iframe)

  const idoc = iframe.contentWindow?.document
  if (!idoc) { iframe.remove(); return }

  idoc.open()
  idoc.write(
    `<!doctype html><html><head><meta charset="utf-8">${heads}` +
    `<style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}` +
    `.print-area{position:static!important}</style></head>` +
    `<body>${el.outerHTML}</body></html>`
  )
  idoc.close()

  // Laisse le temps aux feuilles de styles (et images data:) de s'appliquer.
  const fire = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      setTimeout(() => iframe.remove(), 2000)
    }
  }
  // Si l'iframe déclenche load (feuilles chargées), imprime aussitôt ; sinon repli.
  let done = false
  iframe.onload = () => { if (!done) { done = true; setTimeout(fire, 150) } }
  setTimeout(() => { if (!done) { done = true; fire() } }, 700)
}
