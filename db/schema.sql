-- ============================================================================
--  DrogueriePro — Schéma Turso (libSQL / SQLite) — "document store"
--  La table `records` contient TOUTES les entités métier (une ligne JSON par
--  enregistrement). `users`/`auth_tokens` gèrent l'authentification.
-- ============================================================================

CREATE TABLE IF NOT EXISTS records (
  collection  TEXT    NOT NULL,           -- 'products','sales','clients',...
  id          TEXT    NOT NULL,
  store_id    TEXT,                       -- NULL pour les données partagées
  data        TEXT    NOT NULL,           -- JSON complet de l'enregistrement
  updated_at  INTEGER NOT NULL,           -- epoch ms (source de vérité pour la synchro)
  deleted     INTEGER NOT NULL DEFAULT 0, -- suppression logique
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS idx_records_sync  ON records (collection, updated_at);
CREATE INDEX IF NOT EXISTS idx_records_store ON records (collection, store_id, updated_at);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT UNIQUE,
  password_hash TEXT, pin_hash TEXT, role TEXT NOT NULL,
  store_ids TEXT NOT NULL DEFAULT '[]', active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens (user_id);
