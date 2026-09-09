-- Shared-trip schema used by /api/trip/* and /api/sync. Payloads are client-encrypted; the server stores ciphertext, versions and tombstones.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS trips (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 created_at TEXT NOT NULL,
 encryption_salt TEXT NOT NULL,
 key_version INTEGER NOT NULL DEFAULT 1 CHECK(key_version > 0)
);
CREATE TABLE IF NOT EXISTS members (
 id TEXT PRIMARY KEY,
 trip_id TEXT NOT NULL REFERENCES trips(id),
 role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')),
 token_hash TEXT NOT NULL UNIQUE,
 revoked_at TEXT,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS members_trip ON members(trip_id);
CREATE TABLE IF NOT EXISTS records (
 trip_id TEXT NOT NULL REFERENCES trips(id),
 id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('place','checklist','day','stay','asset')),
 encrypted_payload TEXT NOT NULL,
 key_version INTEGER NOT NULL,
 version INTEGER NOT NULL CHECK(version > 0),
 deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
 updated_at TEXT NOT NULL,
 updated_by TEXT NOT NULL REFERENCES members(id),
 PRIMARY KEY(trip_id,id)
);
CREATE TABLE IF NOT EXISTS changes (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 trip_id TEXT NOT NULL REFERENCES trips(id),
 record_id TEXT NOT NULL,
 version INTEGER NOT NULL,
 encrypted_payload TEXT NOT NULL,
 deleted INTEGER NOT NULL,
 changed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS changes_trip_cursor ON changes(trip_id, sequence);
CREATE TABLE IF NOT EXISTS mutation_receipts (
 trip_id TEXT NOT NULL REFERENCES trips(id),
 member_id TEXT NOT NULL REFERENCES members(id),
 mutation_id TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 response_json TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(trip_id,member_id,mutation_id)
);
-- Expiring single-use invite hashes, never plaintext join secrets in query strings.
CREATE TABLE IF NOT EXISTS invites (
 id TEXT PRIMARY KEY,
 trip_id TEXT NOT NULL REFERENCES trips(id),
 secret_hash TEXT NOT NULL UNIQUE,
 role TEXT NOT NULL CHECK(role IN ('editor','viewer')),
 expires_at TEXT NOT NULL,
 consumed_at TEXT
);
