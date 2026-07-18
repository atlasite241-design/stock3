import { NextResponse } from 'next/server'
import { rowsOf, tursoExec } from '@/lib/turso-http'

export const dynamic = 'force-dynamic'

export async function GET() {
  const r = await tursoExec([{ sql: 'SELECT months, count(*) AS n FROM license_keys GROUP BY months ORDER BY months' }])
  if (!r.ok) return NextResponse.json({ ok: false, error: 'network' }, { status: 502 })
  const rows = rowsOf(r.results?.[0])
  const stats = rows.map((row) => ({ months: Number(row[0]?.value) || 0, count: Number(row[1]?.value) || 0 }))
  return NextResponse.json({ ok: true, stats })
}
