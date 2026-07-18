import 'server-only'

// Appel HTTP direct à l'API Turso (pipeline v2), CÔTÉ SERVEUR uniquement.
// Utilise le token serveur (TURSO_AUTH_TOKEN) — jamais exposé au navigateur.
// On passe par HTTPS (et non le protocole libsql) pour une portée réseau maximale.

type Arg = { type: 'text' | 'integer'; value: string }
type Stmt = { sql: string; args?: Arg[] }

function httpBase(): string {
  const url = process.env.TURSO_DATABASE_URL || ''
  return url.replace(/^libsql:\/\//, 'https://').replace(/^wss:\/\//, 'https://').replace(/\/+$/, '')
}

export interface TursoResultRow {
  [i: number]: { type: string; value: string }
}

export async function tursoExec(statements: Stmt[]): Promise<{ ok: boolean; results?: unknown[]; error?: string }> {
  const base = httpBase()
  const token = process.env.TURSO_AUTH_TOKEN
  if (!base || !token) return { ok: false, error: 'unconfigured' }
  try {
    const res = await fetch(`${base}/v2/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [...statements.map((s) => ({ type: 'execute', stmt: s })), { type: 'close' }] }),
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, error: `http_${res.status}` }
    const json = (await res.json()) as { results?: Array<{ type: string; error?: { message: string }; response?: { result?: { rows?: unknown[] } } }> }
    const results = json.results ?? []
    const firstErr = results.find((r) => r.type === 'error')
    if (firstErr) return { ok: false, error: firstErr.error?.message ?? 'sql_error' }
    return { ok: true, results }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network' }
  }
}

// Extrait les lignes (tableau de cellules {type,value}) d'un résultat d'execute.
export function rowsOf(result: unknown): { value: string }[][] {
  const r = result as { response?: { result?: { rows?: { value: string }[][] } } }
  return r?.response?.result?.rows ?? []
}
