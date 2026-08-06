'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import SevenSegment from './SevenSegment'
import { useLanguage } from '@/lib/i18n'

/**
 * Barre de pagination.
 *
 * Trois informations, et pas une de plus : où l'on est, combien il y a en
 * tout, et comment aller ailleurs. L'ancienne version affichait « 1380 · 2/28 »
 * — exact, et illisible : rien ne dit lequel des trois nombres est la page.
 */

export interface PaginationProps {
  page: number
  pageCount: number
  /** Nombre total de résultats, toutes pages confondues. */
  total?: number
  onChange: (page: number) => void
  /** Nombre maximal de boutons numérotés affichés. */
  fenetre?: number
  /**
   * Cadre et fond propres.
   *
   * `false` quand la barre vit déjà dans un pied de carte : deux bordures
   * imbriquées se voient, et donnent l'impression d'un élément posé de
   * travers plutôt qu'intégré.
   */
  encadre?: boolean
  className?: string
}

export default function Pagination({
  page,
  pageCount,
  total,
  onChange,
  fenetre = 5,
  encadre = true,
  className = '',
}: PaginationProps) {
  const { t } = useLanguage()

  if (pageCount <= 1) return null

  const aller = (p: number) => onChange(Math.min(pageCount, Math.max(1, p)))

  /*
   * Fenêtre glissante de numéros.
   *
   * Afficher les 28 pages d'un import obligerait à chercher le bouton courant
   * parmi les autres. On en montre quelques-uns autour de la position, et les
   * quatre flèches couvrent le reste — dont les deux doubles, qui vont aux
   * extrémités sans avoir à cliquer vingt-six fois.
   */
  const debut = Math.max(1, Math.min(page - Math.floor(fenetre / 2), pageCount - fenetre + 1))
  const numeros = Array.from({ length: Math.min(fenetre, pageCount) }, (_, i) => debut + i)

  const btn =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ' +
    'border-gray-200 text-gray-500 hover:bg-gray-50 ' +
    'disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent ' +
    'dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/5'

  return (
    <div
      className={
        'flex flex-wrap items-center justify-between gap-3 ' +
        (encadre
          ? 'rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03] '
          : '') +
        className
      }
    >
      {/* --- Position et volume, en afficheur --- */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 dark:border-white/10 dark:bg-black/30">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px] shadow-sky-400" aria-hidden="true" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-zinc-500">
            {t('pag_page')}
          </span>
          <SevenSegment value={page} size={18} couleur="#38bdf8" className="text-gray-400 dark:text-zinc-600" />
          <span className="text-gray-300 dark:text-zinc-700" aria-hidden="true">/</span>
          <SevenSegment value={pageCount} size={18} couleur="#38bdf8" className="text-gray-400 dark:text-zinc-600" />
        </div>

        {total !== undefined && (
          <div className="leading-none">
            <SevenSegment value={total} size={20} couleur="#38bdf8" className="text-gray-400 dark:text-zinc-600" />
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-zinc-500">
              {t('pag_results')}
            </div>
          </div>
        )}
      </div>

      {/* --- Navigation --- */}
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => aller(1)} disabled={page === 1} className={btn} aria-label={t('pag_first')}>
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => aller(page - 1)} disabled={page === 1} className={btn} aria-label={t('pag_prev')}>
          <ChevronLeft className="h-4 w-4" />
        </button>

        {numeros.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => aller(n)}
            aria-current={n === page ? 'page' : undefined}
            className={
              n === page
                ? 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-sky-400 bg-sky-400/10 px-1 font-semibold text-sky-500 shadow-[0_0_10px_-2px] shadow-sky-400/60 dark:text-sky-300'
                : btn + ' min-w-8 px-1'
            }
          >
            <SevenSegment value={n} size={14} couleur={n === page ? '#38bdf8' : 'currentColor'} fantome={n === page ? 0.16 : 0.1} />
          </button>
        ))}

        <button type="button" onClick={() => aller(page + 1)} disabled={page === pageCount} className={btn} aria-label={t('pag_next')}>
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => aller(pageCount)} disabled={page === pageCount} className={btn} aria-label={t('pag_last')}>
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
