'use client'

// Saisie décimale qui accepte la VIRGULE comme le point.
//
// `<input type="number">` refuse la virgule dès que la locale du navigateur ne
// la reconnaît pas comme séparateur décimal : le vendeur tape « 7,5 » et le
// champ reste vide, sans le moindre message. Or au Maroc comme en France, la
// virgule est ce qu'on tape.
//
// Le champ garde donc son propre brouillon de texte : « 7, » reste affichable
// le temps de finir la saisie, alors qu'un champ contrôlé par un nombre
// l'effacerait à chaque frappe.

import { useEffect, useState } from 'react'

const parse = (s: string): number => Number(s.replace(',', '.'))

export default function DecimalInput({
  value,
  onChange,
  className = '',
  min = 0,
  autoSelect = false,
  placeholder,
}: {
  value: number
  onChange: (n: number) => void
  className?: string
  min?: number
  autoSelect?: boolean
  placeholder?: string
}) {
  const [draft, setDraft] = useState(String(value ?? ''))

  // On ne réaligne le brouillon que si la valeur reçue diffère RÉELLEMENT de ce
  // qui est tapé : sinon « 7, » se verrait réécrit en « 7 » à la frappe suivante.
  useEffect(() => {
    if (parse(draft) !== value) setDraft(value ? String(value) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      placeholder={placeholder}
      onFocus={autoSelect ? (e) => e.target.select() : undefined}
      onChange={(e) => {
        const txt = e.target.value
        // Chiffres, un séparateur, rien d'autre : on refuse la saisie plutôt que
        // d'accepter un texte que le calcul transformerait en NaN.
        if (txt !== '' && !/^\d*[.,]?\d*$/.test(txt)) return
        setDraft(txt)
        const n = parse(txt)
        if (txt !== '' && Number.isFinite(n) && n >= min) onChange(n)
      }}
      onBlur={() => setDraft(value ? String(value) : '')}
      className={className}
    />
  )
}
