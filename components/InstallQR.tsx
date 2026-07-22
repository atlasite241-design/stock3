'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** Génère le QR code d'une URL côté client (aucun appel externe → marche hors-ligne). */
export default function InstallQR({ url, size = 176 }: { url: string; size?: number }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    if (!url) return
    QRCode.toDataURL(url, { width: size * 2, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111827', light: '#ffffff' } })
      .then(setSrc)
      .catch(() => setSrc(''))
  }, [url, size])

  if (!src) {
    return <div style={{ width: size, height: size }} className="animate-pulse rounded-xl bg-gray-100 dark:bg-white/10" />
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="QR" className="rounded-xl border border-gray-200 bg-white p-2 dark:border-white/10" />
}
