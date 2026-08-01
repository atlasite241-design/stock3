import { NextRequest, NextResponse } from 'next/server'
import { tursoExec } from '@/lib/turso-http'
import { COOKIE_NAME, readSession } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

/**
 * Remise à zéro des DONNÉES MÉTIER, côté serveur.
 *
 * Vider le stockage local ne suffit pas : la synchro rapatrierait tout depuis
 * Turso quelques secondes plus tard. C'est donc le serveur qui efface.
 *
 * Ce qui est CONSERVÉ, délibérément :
 *   - `users`    : sans quoi plus personne ne pourrait se connecter ;
 *   - `stores`   : le magasin actif disparaîtrait ;
 *   - `settings` : société, TVA, impression, droits par rôle.
 * Les clés de licence vivent dans une table distincte (`license_keys`) : elles
 * ne sont jamais touchées ici.
 */
const WIPE = [
  'products', 'sales', 'clients', 'suppliers', 'movements', 'purchases',
  'quotes', 'returns', 'cash', 'sessions', 'activity', 'credits', 'loyalty',
  'expenses', 'revenues', 'transfers', 'depots',
  'zones', 'allees', 'rayons', 'etageres', 'niveaux', 'positions', 'emplacements',
  'categories', 'subcategories', 'brands', 'units',
] as const

export const KEPT = ['users', 'stores', 'settings'] as const

export async function POST(req: NextRequest) {
  const session = readSession(req.cookies.get(COOKIE_NAME)?.value)
  if (!session || !Array.isArray(session.perms)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  // Action destructrice : réservée à qui peut déjà réinitialiser les compteurs.
  if (!session.perms.includes('set.reset_stats')) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  let confirm = ''
  try { confirm = String((await req.json())?.confirm ?? '') } catch { /* corps vide */ }
  // Garde-fou serveur : même avec la bonne session, un appel accidentel ne
  // suffit pas — le mot exact doit être transmis.
  if (confirm !== 'EFFACER') {
    return NextResponse.json({ ok: false, error: 'confirm_required' }, { status: 400 })
  }

  const list = WIPE.map((c) => `'${c}'`).join(',')
  // Comptage AVANT, pour pouvoir rendre compte de ce qui a réellement disparu.
  const before = await tursoExec([{ sql: `SELECT COUNT(*) FROM records WHERE collection IN (${list})` }])
  if (!before.ok) return NextResponse.json({ ok: false, error: before.error }, { status: 502 })

  const del = await tursoExec([{ sql: `DELETE FROM records WHERE collection IN (${list})` }])
  if (!del.ok) return NextResponse.json({ ok: false, error: del.error }, { status: 502 })

  const r = before.results?.[0] as { response?: { result?: { rows?: { value: string }[][] } } } | undefined
  const deleted = Number(r?.response?.result?.rows?.[0]?.[0]?.value ?? 0)

  return NextResponse.json({ ok: true, deleted, wiped: WIPE, kept: KEPT })
}
