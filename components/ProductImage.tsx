'use client'

import {
  Bath,
  Bolt,
  Combine,
  CookingPot,
  Disc3,
  Droplets,
  Flame,
  Hammer,
  HardHat,
  KeyRound,
  Lightbulb,
  Package,
  Package2,
  PaintBucket,
  PencilRuler,
  Sparkles,
  SprayCan,
  Sprout,
  Syringe,
  Wrench,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Map a (dynamic) category name to a placeholder icon + tinted colours.
// Couvre les 20 catégories de la droguerie ; repli générique sinon.
// NB : classes Tailwind écrites en toutes lettres (le JIT n'analyse pas les
// noms de classes construits dynamiquement).
function categoryVisual(category: string): { Icon: LucideIcon; cls: string } {
  const c = (category || '').toLowerCase()
  if (c.includes('peinture')) return { Icon: PaintBucket, cls: 'bg-rose-100 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400' }
  if (c.includes('électr') || c.includes('electr')) return { Icon: Zap, cls: 'bg-amber-100 text-amber-500 dark:bg-amber-500/15 dark:text-amber-400' }
  if (c.includes('plomb')) return { Icon: Droplets, cls: 'bg-sky-100 text-sky-500 dark:bg-sky-500/15 dark:text-sky-400' }
  if (c.includes('quincaill')) return { Icon: Hammer, cls: 'bg-orange-100 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400' }
  if (c.includes('outil')) return { Icon: Wrench, cls: 'bg-violet-100 text-violet-500 dark:bg-violet-500/15 dark:text-violet-400' }
  if (c.includes('jardin')) return { Icon: Sprout, cls: 'bg-green-100 text-green-500 dark:bg-green-500/15 dark:text-green-400' }
  if (c.includes('colle')) return { Icon: Combine, cls: 'bg-lime-100 text-lime-600 dark:bg-lime-500/15 dark:text-lime-400' }
  if (c.includes('silic')) return { Icon: Syringe, cls: 'bg-cyan-100 text-cyan-500 dark:bg-cyan-500/15 dark:text-cyan-400' }
  if (c.includes('serrur')) return { Icon: KeyRound, cls: 'bg-stone-100 text-stone-500 dark:bg-stone-500/15 dark:text-stone-300' }
  if (c.includes('viss')) return { Icon: Bolt, cls: 'bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300' }
  if (c.includes('abras')) return { Icon: Disc3, cls: 'bg-indigo-100 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-400' }
  if (c.includes('éclair') || c.includes('eclair') || c.includes('led') || c.includes('ampoule')) return { Icon: Lightbulb, cls: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-500/15 dark:text-yellow-400' }
  if (c.includes('emball')) return { Icon: Package2, cls: 'bg-teal-100 text-teal-500 dark:bg-teal-500/15 dark:text-teal-400' }
  if (c.includes('cuisine')) return { Icon: CookingPot, cls: 'bg-red-100 text-red-500 dark:bg-red-500/15 dark:text-red-400' }
  if (c.includes('bain')) return { Icon: Bath, cls: 'bg-blue-100 text-blue-500 dark:bg-blue-500/15 dark:text-blue-400' }
  if (c.includes('gaz')) return { Icon: Flame, cls: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300' }
  if (c.includes('nettoy')) return { Icon: SprayCan, cls: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400' }
  if (c.includes('protection') || c.includes('sécur') || c.includes('secur')) return { Icon: HardHat, cls: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-300' }
  if (c.includes('bricol')) return { Icon: PencilRuler, cls: 'bg-fuchsia-100 text-fuchsia-500 dark:bg-fuchsia-500/15 dark:text-fuchsia-400' }
  if (c.includes('entretien')) return { Icon: Sparkles, cls: 'bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300' }
  return { Icon: Package, cls: 'bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-zinc-400' }
}

/**
 * Renders a product's photo if it has one, otherwise a category-tinted
 * placeholder icon. `iconSize` controls the placeholder icon size.
 */
export default function ProductImage({
  image,
  category,
  alt,
  className = '',
  iconSize = 'h-8 w-8',
  fit = 'cover',
}: {
  image?: string
  category: string
  alt?: string
  className?: string
  iconSize?: string
  fit?: 'cover' | 'contain'
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={alt || category} className={`h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`} />
  }
  const { Icon, cls } = categoryVisual(category)
  return (
    <div className={`flex h-full w-full items-center justify-center ${cls} ${className}`}>
      <Icon className={iconSize} strokeWidth={1.5} />
    </div>
  )
}
