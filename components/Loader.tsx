'use client'

/**
 * Loader animé « égaliseur » (barres orange) — remplace le texte « Chargement… ».
 * Reprend le gabarit centré (h-64) des états de chargement des pages.
 */
export default function Loader({ className = '', barCount = 5 }: { className?: string; barCount?: number }) {
  const bars = Array.from({ length: barCount })
  return (
    <div className={`flex min-h-[70vh] w-full items-center justify-center ${className}`} role="status" aria-label="Chargement">
      <div className="flex items-end gap-1.5" style={{ height: 32 }}>
        {bars.map((_, i) => (
          <span
            key={i}
            className="w-2 rounded-full bg-gradient-to-t from-amber-500 to-yellow-400"
            style={{
              height: '100%',
              transformOrigin: 'bottom',
              animation: 'loaderBars 1s ease-in-out infinite',
              animationDelay: `${i * 0.13}s`,
            }}
          />
        ))}
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  )
}
