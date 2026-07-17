'use client'

import { useEffect, useState } from 'react'
import { countRemote, localCounts, pushAll, syncState } from '@/lib/sync'
import { tursoConfigured } from '@/lib/turso'
import { useDroguerie } from '@/lib/store'

export default function SyncPage() {
  // Monter useDroguerie déclenche startSync() (comme sur les vraies pages).
  const { addProduct } = useDroguerie()

  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<{ collection: string; local: number; remote: number }[]>([])
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  const add = (m: string) => setLog((l) => [...l, m])

  const refresh = async () => {
    setError('')
    try {
      const local = localCounts()
      const remote = await countRemote()
      const rmap = new Map(remote.map((r) => [r.collection, r.n]))
      setRows(local.map((l) => ({ collection: l.collection, local: l.n, remote: rmap.get(l.collection) ?? 0 })))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void refresh()
    const id = setInterval(() => {
      setTick((t) => t + 1)
      void refresh()
    }, 2000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addTestProduct = () => {
    addProduct({ name: 'TEST-' + Date.now().toString().slice(-5), barcode: '', category: 'Divers', brand: '', unit: 'Pièce', price: 1, cost: 0, stock: 1, minStock: 0 })
  }

  const migrate = async () => {
    setBusy(true)
    setError('')
    setLog([])
    try {
      add('→ Envoi des données locales vers Turso…')
      const total = await pushAll((collection, n) => add(`   • ${collection} : ${n}`))
      add(`✓ Terminé — ${total} enregistrements envoyés.`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const badge = (ok: boolean, label: string) => (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#166534' : '#991b1b' }}>{label}</span>
  )

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '32px auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>Synchronisation Turso — diagnostic</h1>

      {/* État */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {badge(tursoConfigured(), tursoConfigured() ? 'Turso configuré' : 'Turso NON configuré')}
        {badge(syncState.started, syncState.started ? 'Synchro active' : 'Synchro inactive')}
        <span style={{ fontSize: 13, color: '#64748b' }} data-tick={tick}>
          {syncState.lastPushAt
            ? `Dernier envoi : ${new Date(syncState.lastPushAt).toLocaleTimeString('fr-FR')} (${syncState.lastPushCollection})`
            : 'Aucun envoi auto pour l’instant'}
        </span>
      </div>
      {syncState.lastError && (
        <div style={{ marginTop: 10, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
          <b style={{ color: '#dc2626' }}>Dernière erreur synchro :</b>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 6, fontSize: 12 }}>{syncState.lastError}</pre>
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button onClick={migrate} disabled={busy} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#0ea5e9', color: '#fff', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'En cours…' : 'Tout renvoyer vers Turso'}
        </button>
        <button onClick={refresh} disabled={busy} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          Rafraîchir les compteurs
        </button>
        <button onClick={addTestProduct} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          ➕ Ajouter un produit test
        </button>
      </div>

      {/* Journal de synchro (temps réel) */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 20 }}>Journal de synchro</h2>
      <pre style={{ marginTop: 8, padding: 14, background: '#0b1326', color: '#dae2fd', borderRadius: 12, whiteSpace: 'pre-wrap', fontSize: 12, minHeight: 60 }}>
        {syncState.log.length ? syncState.log.join('\n') : '(aucune activité de synchro encore)'}
      </pre>

      {log.length > 0 && (
        <pre style={{ marginTop: 16, padding: 16, background: '#0b1326', color: '#dae2fd', borderRadius: 12, whiteSpace: 'pre-wrap', fontSize: 13 }}>{log.join('\n')}</pre>
      )}

      {error && (
        <div style={{ marginTop: 16, padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12 }}>
          <b style={{ color: '#dc2626' }}>Erreur :</b>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 13 }}>{error}</pre>
        </div>
      )}

      {/* Local vs Turso */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 24 }}>Local vs Turso</h2>
      <p style={{ fontSize: 13, color: '#64748b' }}>Une différence (local &gt; Turso) signale un changement pas encore synchronisé.</p>
      <table style={{ marginTop: 8, borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 12 }}>
            <th style={{ padding: '6px 8px' }}>Collection</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Local</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Turso</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const diff = r.local !== r.remote
            return (
              <tr key={r.collection} style={{ borderBottom: '1px solid #e2e8f0', background: diff ? '#fff7ed' : undefined }}>
                <td style={{ padding: '6px 8px' }}>{r.collection}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{r.local}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: diff ? '#c2410c' : '#166534' }}>{r.remote}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
