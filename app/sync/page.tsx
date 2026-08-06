'use client'

import { useEffect, useState } from 'react'
import { countRemote, localCounts, pushAll, reparerImagesRecues, resyncFromStart, syncState } from '@/lib/sync'
import { apiMigrate } from '@/lib/sync-api'
import { COLLECTIONS } from '@/lib/sync'
import { tursoConfigured } from '@/lib/sync'
import { useDroguerie } from '@/lib/store'
import { initProductCache, localStorageUsage, productCacheReady } from '@/lib/pstore'

export default function SyncPage() {
  // Monter useDroguerie déclenche startSync() (comme sur les vraies pages).
  const { addProduct } = useDroguerie()

  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  // `remote: null` = pas encore compté. Le COUNT distant balaie toute la table :
  // il ne part plus au montage, seulement sur clic explicite.
  const [rows, setRows] = useState<{ collection: string; local: number; remote: number | null }[]>([])
  // Poids réel de localStorage. Son plafond (~5 Mo pour toute l'origine) est une
  // panne silencieuse : une fois atteint, TOUTE écriture échoue — les réglages,
  // la file hors-ligne, la caisse — sans que rien ne l'indique à l'écran.
  const [stockage, setStockage] = useState<{ key: string; bytes: number }[]>([])
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  const add = (m: string) => setLog((l) => [...l, m])

  /** Comptage LOCAL seul : aucune requête serveur, donc aucun coût de lecture. */
  const refreshLocal = async () => {
    setStockage(localStorageUsage())
    if (!productCacheReady()) await initProductCache()
    setRows(localCounts().map((l) => ({ collection: l.collection, local: l.n, remote: null })))
  }

  const refresh = async () => {
    setError('')
    try {
      setStockage(localStorageUsage())
      // Le catalogue vit dans IndexedDB, dont la lecture est asynchrone. Compter
      // avant qu'elle soit terminée affichait « products : 0 » sur un poste qui
      // en détenait des dizaines de milliers — un faux vide, précisément le
      // symptôme qu'on cherche à diagnostiquer ici.
      if (!productCacheReady()) await initProductCache()
      const local = localCounts()
      const remote = await countRemote()
      const rmap = new Map(remote.map((r) => [r.collection, r.n]))
      setRows(local.map((l) => ({ collection: l.collection, local: l.n, remote: rmap.get(l.collection) ?? 0 })))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    // Un SEUL comptage au montage. L'ancien appel toutes les 2 s relançait un
    // COUNT(*) sur toute la table (~20 000 lignes lues) → ~36 M lignes/heure si
    // la page restait ouverte. Les compteurs se rafraîchissent maintenant via le
    // bouton « Rafraîchir les compteurs ». Le tick ne fait qu'un re-rendu léger
    // pour montrer le journal de synchro en direct (aucune requête DB).
    void refreshLocal()
    const id = setInterval(() => setTick((t) => t + 1), 2000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resync = async () => {
    setBusy(true)
    setError('')
    setLog([])
    try {
      add('↺ Re-téléchargement complet depuis Turso…')
      const n = await resyncFromStart()
      add(`✓ Terminé — ${n} enregistrement(s) rapatrié(s). Données à jour.`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const migrer = async () => {
    setBusy(true)
    setError('')
    setLog([])
    try {
      add('⚙ Création des index manquants sur la base…')
      const n = await apiMigrate()
      add(`✓ ${n} index vérifiés/créés. Les lectures de synchro cessent de balayer toute la table.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  /**
   * Export des collections RH en JSON — pour la reprise vers le module Laravel.
   *
   * Lit le LOCAL, pas le serveur : c'est ce poste qui detient la verite du
   * moment, et l'export ne coute aucune lecture Turso. Le fichier se donne a
   * la commande `php artisan hr:reprendre`.
   */
  const exporterRH = () => {
    const collections: Record<string, unknown> = {}
    let n = 0
    for (const c of COLLECTIONS) {
      if (!c.collection.startsWith('hr')) continue
      try {
        const brut = localStorage.getItem(c.key)
        const valeurs = brut ? JSON.parse(brut) : []
        collections[c.collection] = valeurs
        n += Array.isArray(valeurs) ? valeurs.length : 0
      } catch {
        collections[c.collection] = []
      }
    }
    const blob = new Blob(
      [JSON.stringify({ exported_at: new Date().toISOString(), collections }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `export-rh-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setLog((l) => [...l, `⇩ export RH : ${n} enregistrement(s) dans ${Object.keys(collections).length} collections`])
  }

  const reduireImages = async () => {
    setBusy(true)
    setError('')
    setLog([])
    try {
      add('🖼 Réduction des images stockées…')
      await reparerImagesRecues()
      add('✓ Terminé. Voir le poids par clé ci-dessous.')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

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
      {/* Quelle version du code s'exécute réellement dans cet onglet. */}
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontFamily: 'ui-monospace, monospace' }}>
        build {process.env.NEXT_PUBLIC_COMMIT || 'inconnu'}
      </p>

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
        <button onClick={resync} disabled={busy} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'En cours…' : '↺ Re-télécharger tout depuis Turso'}
        </button>
        <button onClick={refresh} disabled={busy} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          Rafraîchir les compteurs
        </button>
        <button onClick={migrer} disabled={busy} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          ⚙ Créer les index
        </button>
        <button onClick={reduireImages} disabled={busy} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#ea580c', color: '#fff', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          🖼 Réduire les images stockées
        </button>
        <button onClick={exporterRH} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          ⇩ Exporter les données RH (JSON)
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

      {/* Occupation de localStorage */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 24 }}>Stockage local du navigateur</h2>
      {(() => {
        const total = stockage.reduce((a, x) => a + x.bytes, 0)
        const PLAFOND = 5 * 1024 * 1024 // ~5 Mo, valeur usuelle par origine
        const pct = Math.round((total / PLAFOND) * 100)
        const ko = (b: number) => (b / 1024).toFixed(b < 10240 ? 1 : 0) + ' Ko'
        return (
          <>
            <p style={{ fontSize: 13, color: pct >= 80 ? '#c2410c' : '#64748b' }}>
              {ko(total)} utilisés sur ~5 Mo ({pct} %). Au-delà du plafond, plus aucune donnée
              ne peut être enregistrée : les réglages et les ventes en attente sont perdus en silence.
              Le catalogue produits, lui, vit dans IndexedDB et ne compte pas ici.
            </p>
            <table style={{ marginTop: 8, borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 12 }}>
                  <th style={{ padding: '6px 8px' }}>Clé</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Poids</th>
                </tr>
              </thead>
              <tbody>
                {stockage.slice(0, 10).map((x) => (
                  <tr key={x.key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 8px', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{x.key}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: x.bytes > 512 * 1024 ? '#c2410c' : undefined }}>{ko(x.bytes)}</td>
                  </tr>
                ))}
                {stockage.length > 10 && (
                  <tr><td colSpan={2} style={{ padding: '6px 8px', fontSize: 12, color: '#64748b' }}>+ {stockage.length - 10} autres clés</td></tr>
                )}
              </tbody>
            </table>
          </>
        )
      })()}

      {/* Local vs Turso */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 24 }}>Local vs Turso</h2>
      <p style={{ fontSize: 13, color: '#64748b' }}>
        Une différence (local &gt; Turso) signale un changement pas encore synchronisé. La colonne
        Turso reste à « — » tant qu'on ne la demande pas : ce comptage balaie toute la table
        distante, et il ne doit pas partir tout seul à chaque ouverture de la page.
      </p>
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
            const diff = r.remote != null && r.local !== r.remote
            return (
              <tr key={r.collection} style={{ borderBottom: '1px solid #e2e8f0', background: diff ? '#fff7ed' : undefined }}>
                <td style={{ padding: '6px 8px' }}>{r.collection}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{r.local}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: diff ? '#c2410c' : '#166534' }}>
                  {r.remote == null ? '—' : r.remote}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
