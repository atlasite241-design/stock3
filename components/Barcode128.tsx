'use client'

import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

/**
 * Code-barres CODE128 (alphanumérique) — utilisé pour les codes client « CLT-… »
 * que l'EAN-13 (numérique) ne peut pas encoder. Rendu dans un <svg> via JsBarcode.
 */
export default function Barcode128({
  value,
  height = 34,
  width = 1.4,
  fontSize = 11,
  displayValue = true,
}: {
  value: string
  height?: number
  width?: number
  fontSize?: number
  displayValue?: boolean
}) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        height,
        width,
        fontSize,
        displayValue,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      })
    } catch {
      /* valeur invalide : on n'affiche rien */
    }
  }, [value, height, width, fontSize, displayValue])

  // Fond blanc obligatoire : un code-barres doit rester noir sur blanc pour être
  // visible (mode sombre) ET lisible par un scanner.
  return (
    <span className="inline-block rounded bg-white p-1">
      <svg ref={ref} className="block max-w-full" />
    </span>
  )
}
