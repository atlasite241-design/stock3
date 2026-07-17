'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@libsql/client/web'

/**
 * Test de connexion NAVIGATEUR → Turso (direct).
 * Ouvre http://localhost:3007/db-test dans ton navigateur.
 * But : vérifier que le navigateur peut lire la base (et qu'il n'y a pas de blocage CORS)
 * avant de construire le moteur de synchronisation.
 */
export default function DbTestPage() {
  const [status, setStatus] = useState<'…' | 'OK' | 'ERREUR'>('…')
  const [tables, setTables] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_TURSO_DATABASE_URL
    const authToken = process.env.NEXT_PUBLIC_TURSO_AUTH_TOKEN
    if (!url) {
      setStatus('ERREUR')
      setError('NEXT_PUBLIC_TURSO_DATABASE_URL manquant — redémarre `npm run dev` après avoir mis à jour .env.local.')
      return
    }
    const db = createClient({ url, authToken })
    db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .then((r) => {
        setTables(r.rows.map((x) => String(x.name)))
        setStatus('OK')
      })
      .catch((e: unknown) => {
        setStatus('ERREUR')
        setError(e instanceof Error ? e.message : String(e))
      })
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '40px auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>Test connexion navigateur → Turso</h1>
      <p style={{ marginTop: 8, fontSize: 18 }}>
        Statut :{' '}
        <b style={{ color: status === 'OK' ? '#16a34a' : status === 'ERREUR' ? '#dc2626' : '#64748b' }}>{status}</b>
      </p>

      {status === 'OK' && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontWeight: 700 }}>✓ Connexion réussie — {tables.length} table(s) :</p>
          <ul style={{ marginTop: 8, columns: 2, fontSize: 14 }}>
            {tables.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p style={{ marginTop: 16, color: '#16a34a', fontWeight: 700 }}>
            👍 Le navigateur peut parler à Turso. On peut construire la synchronisation.
          </p>
        </div>
      )}

      {status === 'ERREUR' && (
        <div style={{ marginTop: 16, padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12 }}>
          <p style={{ fontWeight: 700, color: '#dc2626' }}>Erreur :</p>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 13 }}>{error}</pre>
          <p style={{ marginTop: 12, fontSize: 13, color: '#64748b' }}>
            Copie ce message et envoie-le-moi. Si l'erreur parle de « CORS » ou « Failed to fetch », on adaptera.
          </p>
        </div>
      )}
    </div>
  )
}
