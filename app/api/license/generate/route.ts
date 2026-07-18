import { NextRequest, NextResponse } from 'next/server'
import { tursoExec } from '@/lib/turso-http'

export const dynamic = 'force-dynamic'

const KEY_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function seg(n: number): string {
  let s = ''
  for (let i = 0; i < n; i++) s += KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)]
  return s
}
function genKey(): string {
  return `ATLS-${seg(5)}-${seg(5)}-${seg(5)}`
}

export async function POST(req: NextRequest) {
  let months = 1
  let count = 0
  try {
    const body = await req.json()
    months = Number(body?.months) || 1
    count = Number(body?.count) || 0
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }
  if (![1, 3, 6, 12].includes(months)) months = 1
  const n = Math.max(1, Math.min(500, Math.floor(count)))

  const seen = new Set<string>()
  const keys: string[] = []
  while (keys.length < n) {
    const k = genKey()
    if (!seen.has(k)) {
      seen.add(k)
      keys.push(k)
    }
  }

  const placeholders = keys.map(() => '(?, ?)').join(',')
  const args = keys.flatMap((k) => [
    { type: 'text' as const, value: k },
    { type: 'integer' as const, value: String(months) },
  ])
  const r = await tursoExec([{ sql: `INSERT OR IGNORE INTO license_keys (key, months) VALUES ${placeholders}`, args }])
  if (!r.ok) return NextResponse.json({ ok: false, error: 'network' }, { status: 502 })

  return NextResponse.json({ ok: true, keys, months })
}
