import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { rowsOf, tursoExec } from '@/lib/turso-http'
import { COOKIE_NAME, readSession } from '@/lib/server-auth'
import { canRead, canWrite, inScope, type Scope } from '@/lib/api-policy'

export const dynamic = 'force-dynamic'

/**
 * Passerelle de synchronisation. Le navigateur n'accède PLUS à Turso : il
 * appelle ces opérations NOMMÉES, exécutées côté serveur avec le token privé.
 *
 * Aucune requête SQL n'est acceptée depuis le client : n'exposer qu'un tunnel
 * « exécute ce SQL » reviendrait à laisser la faille en place sous un autre nom.
 * Seules les cinq opérations ci-dessous existent, toutes paramétrées.
 *
 * Toutes exigent une session serveur valide, sauf `status` (qui ne divulgue
 * aucune donnée métier et sert à savoir si la synchro est configurée).
 */

// Lots volontairement modestes : une réponse de fonction serverless est plafonnée
// (~4,5 Mo) et un enregistrement produit pèse ~1 Ko.
const PAGE = 500
const MAX_UPSERT = 200

const UPSERT = `INSERT INTO records (collection, id, store_id, data, updated_at, deleted)
VALUES (?, ?, ?, ?, ?, 0)
ON CONFLICT(collection, id) DO UPDATE SET
  store_id = excluded.store_id, data = excluded.data,
  updated_at = excluded.updated_at, deleted = 0`

/**
 * Magasin d'un enregistrement, lu dans son JSON. On évite JSON.parse sur des
 * centaines de lignes par requête : une recherche ciblée suffit et coûte bien
 * moins cher.
 */
function storeOf(data: string): string | null {
  const m = /"storeId"\s*:\s*"([^"]*)"/.exec(data)
  return m ? m[1] : null
}

type Cell = { value: string } | undefined
const txt = (c: Cell) => String(c?.value ?? '')
const num = (c: Cell) => Number(c?.value ?? 0)

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 }) }
  const op = String(body.op ?? '')

  // --- status : public, sans donnée métier ---
  if (op === 'status') {
    const url = process.env.TURSO_DATABASE_URL || ''
    const token = process.env.TURSO_AUTH_TOKEN || ''
    const configured = !!(url && token)
    // Empreinte de la base : permet au client de détecter un changement de base
    // sans jamais connaître son URL réelle.
    const dbId = url ? crypto.createHash('sha256').update(url).digest('hex').slice(0, 16) : ''

    // `check: true` teste RÉELLEMENT la connexion. Savoir que les variables
    // existent ne dit pas si le token est valide — c'est cette confusion qui
    // rendait la panne indéchiffrable. La réponse ne contient qu'un code
    // d'erreur (ex. « http_401 »), jamais le secret lui-même.
    if (body.check && configured) {
      const ping = await tursoExec([{ sql: 'SELECT 1' }])
      return NextResponse.json({ ok: true, configured, dbId, reachable: ping.ok, error: ping.error ?? null })
    }
    return NextResponse.json({ ok: true, configured, dbId })
  }

  // --- toutes les autres opérations exigent une session serveur ---
  const session = readSession(req.cookies.get(COOKIE_NAME)?.value)
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  // Cookie émis AVANT l'ajout du périmètre : il ne porte aucune permission.
  // L'accepter reviendrait à tout interdire silencieusement ; on le traite donc
  // comme expiré, ce qui déclenche une reconnexion et régénère un cookie complet.
  if (!Array.isArray(session.perms)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  // Périmètre de la session : ce qu'elle a le droit de lire, d'écrire, et sur
  // quels magasins. Tout est issu du cookie SIGNÉ — rien ne vient du client.
  const scope: Scope = { perms: new Set(session.perms ?? []), storeIds: session.storeIds ?? [] }

  // --- pull : changements depuis un curseur horodaté ---
  if (op === 'pull') {
    const since = Number(body.since ?? 0) || 0
    const r = await tursoExec([{
      sql: 'SELECT collection, id, data, updated_at, deleted FROM records WHERE updated_at > ? ORDER BY updated_at ASC LIMIT ?',
      args: [{ type: 'integer', value: String(since) }, { type: 'integer', value: String(PAGE) }],
    }])
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 })
    // Le curseur avance sur la page ENTIÈRE, mais on ne renvoie que ce que la
    // session peut voir : masquer des lignes ne doit pas bloquer la pagination.
    const all = rowsOf(r.results?.[0]).map((c) => ({
      collection: txt(c[0]), id: txt(c[1]), data: txt(c[2]), updated_at: num(c[3]), deleted: num(c[4]),
    }))
    // maxTs porte sur la page ENTIERE : sans lui, une page entierement filtree
    // laisserait le curseur immobile et la synchro tournerait en rond.
    return NextResponse.json({
      ok: true, page: PAGE, scanned: all.length,
      maxTs: all.reduce((m, x) => Math.max(m, x.updated_at), since),
      rows: all.filter((x) => canRead(x.collection, scope) && inScope(x.collection, storeOf(x.data), scope)),
    })
  }

  // --- all : téléchargement complet, paginé par rowid (curseur stable) ---
  if (op === 'all') {
    const after = Number(body.after ?? 0) || 0
    const r = await tursoExec([{
      sql: 'SELECT rowid, collection, id, data, updated_at FROM records WHERE deleted = 0 AND rowid > ? ORDER BY rowid ASC LIMIT ?',
      args: [{ type: 'integer', value: String(after) }, { type: 'integer', value: String(PAGE) }],
    }])
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 })
    const rows = rowsOf(r.results?.[0])
    const mapped = rows.map((c) => ({ collection: txt(c[1]), id: txt(c[2]), data: txt(c[3]), updated_at: num(c[4]) }))
    return NextResponse.json({
      ok: true, page: PAGE, scanned: rows.length,
      cursor: rows.length ? num(rows[rows.length - 1][0]) : after,
      rows: mapped.filter((x) => canRead(x.collection, scope) && inScope(x.collection, storeOf(x.data), scope)),
    })
  }

  // --- counts : volumétrie par collection (page de diagnostic) ---
  if (op === 'counts') {
    const r = await tursoExec([{ sql: 'SELECT collection, COUNT(*) AS n FROM records WHERE deleted = 0 GROUP BY collection ORDER BY collection' }])
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 })
    return NextResponse.json({
      ok: true,
      rows: rowsOf(r.results?.[0])
        .map((c) => ({ collection: txt(c[0]), n: num(c[1]) }))
        .filter((x) => canRead(x.collection, scope)),
    })
  }

  // --- upsert : écriture d'un lot d'enregistrements ---
  if (op === 'upsert') {
    const raw = Array.isArray(body.rows) ? body.rows : []
    if (raw.length === 0) return NextResponse.json({ ok: true, n: 0 })
    if (raw.length > MAX_UPSERT) return NextResponse.json({ ok: false, error: 'too_many' }, { status: 413 })

    // Une écriture refusée n'est pas ignorée en silence : le client doit savoir
    // que sa modification n'a pas été enregistrée.
    for (const x of raw) {
      const r = x as { collection?: unknown; storeId?: unknown }
      const col = String(r.collection ?? '')
      if (!canWrite(col, scope)) return NextResponse.json({ ok: false, error: 'forbidden_collection', collection: col }, { status: 403 })
      if (!inScope(col, r.storeId == null ? null : String(r.storeId), scope)) {
        return NextResponse.json({ ok: false, error: 'forbidden_store', collection: col }, { status: 403 })
      }
    }
    const stmts = raw.map((x) => {
      const r = x as { collection?: unknown; id?: unknown; storeId?: unknown; data?: unknown; updated_at?: unknown }
      return {
        sql: UPSERT,
        args: [
          { type: 'text' as const, value: String(r.collection ?? '') },
          { type: 'text' as const, value: String(r.id ?? '') },
          r.storeId == null || r.storeId === '' ? { type: 'null' as const } : { type: 'text' as const, value: String(r.storeId) },
          { type: 'text' as const, value: String(r.data ?? '') },
          { type: 'integer' as const, value: String(Number(r.updated_at) || Date.now()) },
        ],
      }
    })
    const r = await tursoExec(stmts)
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 })
    return NextResponse.json({ ok: true, n: stmts.length })
  }

  return NextResponse.json({ ok: false, error: 'unknown_op' }, { status: 400 })
}
