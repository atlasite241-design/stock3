import { NextRequest, NextResponse } from 'next/server'
import { rowsOf, tursoExec } from '@/lib/turso-http'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let key = ''
  try {
    const body = await req.json()
    key = String(body?.key ?? '').trim().toUpperCase()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }
  if (!key) return NextResponse.json({ ok: false, error: 'invalid' })

  // 1) La clé existe-t-elle ?
  const sel = await tursoExec([{ sql: 'SELECT key, months FROM license_keys WHERE key = ? LIMIT 1', args: [{ type: 'text', value: key }] }])
  if (!sel.ok) return NextResponse.json({ ok: false, error: 'network' }, { status: 502 })
  const rows = rowsOf(sel.results?.[0])
  if (rows.length === 0) return NextResponse.json({ ok: false, error: 'invalid' })

  const months = Number(rows[0][1]?.value) || 1

  // 2) Consommation (usage unique).
  const del = await tursoExec([{ sql: 'DELETE FROM license_keys WHERE key = ?', args: [{ type: 'text', value: key }] }])
  if (!del.ok) return NextResponse.json({ ok: false, error: 'network' }, { status: 502 })

  const now = new Date()
  const exp = new Date(now)
  exp.setMonth(exp.getMonth() + months)
  return NextResponse.json({ ok: true, months, expiresAt: exp.toISOString() })
}
