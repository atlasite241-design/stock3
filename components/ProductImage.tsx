'use client'

import {
  Boxes,
  Droplets,
  Hammer,
  Lightbulb,
  Package,
  PaintBucket,
  ShieldCheck,
  Wrench,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Map a (dynamic) category name to a placeholder icon + tinted colours.
function categoryVisual(category: string): { Icon: LucideIcon; cls: string } {
  const c = (category || '').toLowerCase()
  if (c.includes('peinture')) return { Icon: PaintBucket, cls: 'bg-rose-100 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400' }
  if (c.includes('électr') || c.includes('electr')) return { Icon: Zap, cls: 'bg-amber-100 text-amber-500 dark:bg-amber-500/15 dark:text-amber-400' }
  if (c.includes('plomb')) return { Icon: Droplets, cls: 'bg-sky-100 text-sky-500 dark:bg-sky-500/15 dark:text-sky-400' }
  if (c.includes('outil')) return { Icon: Wrench, cls: 'bg-violet-100 text-violet-500 dark:bg-violet-500/15 dark:text-violet-400' }
  if (c.includes('quincaill')) return { Icon: Hammer, cls: 'bg-orange-100 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400' }
  if (c.includes('sécur') || c.includes('secur')) return { Icon: ShieldCheck, cls: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400' }
  if (c.includes('éclair') || c.includes('eclair') || c.includes('led') || c.includes('ampoule')) return { Icon: Lightbulb, cls: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-500/15 dark:text-yellow-400' }
  if (c.includes('droguerie')) return { Icon: Boxes, cls: 'bg-teal-100 text-teal-500 dark:bg-teal-500/15 dark:text-teal-400' }
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
