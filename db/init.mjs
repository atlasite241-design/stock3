// Applique db/schema.sql sur la base Turso et vérifie la connexion.
// Usage : node db/init.mjs   (lit .env.local)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@libsql/client'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// --- Charge .env.local (sans dépendance externe) ---
function loadEnv(file) {
  try {
    const raw = readFileSync(join(root, file), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!process.env[m[1]]) process.env[m[1]] = v
    }
  } catch {}
}
loadEnv('.env.local')

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
if (!url) {
  console.error('❌ TURSO_DATABASE_URL manquant dans .env.local')
  process.exit(1)
}

const db = createClient({ url, authToken })

const schema = readFileSync(join(root, 'db', 'schema.sql'), 'utf8')

try {
  console.log('→ Connexion à Turso…')
  await db.execute('SELECT 1')
  console.log('✓ Connexion OK')

  console.log('→ Application du schéma (db/schema.sql)…')
  await db.executeMultiple(schema)
  console.log('✓ Schéma appliqué')

  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  console.log('✓ Tables présentes :', tables.rows.map((r) => r.name).join(', '))
  process.exit(0)
} catch (e) {
  console.error('❌ Échec :', e.message)
  process.exit(1)
}
