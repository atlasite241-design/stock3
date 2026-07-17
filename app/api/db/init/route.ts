import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Crée toutes les tables sur Turso à partir de db/schema.sql.
 * Ouvre http://localhost:3007/api/db/init dans le navigateur pour l'exécuter.
 * Tourne côté serveur (machine de l'utilisateur) → a bien accès à internet.
 */
export async function GET() {
  try {
    const db = getDb()
    const schema = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8')
    await db.executeMultiple(schema)
    const res = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    const tables = res.rows.map((r) => r.name as string)
    return NextResponse.json({ ok: true, count: tables.length, tables })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
