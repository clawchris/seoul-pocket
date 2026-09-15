-- Votes ("I'm in" / "Pass") are their own records so two phones never race on one row. SQLite cannot relax a CHECK in place.
CREATE TABLE records_new (
 trip_id TEXT NOT NULL REFERENCES trips(id),
 id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('place','vote','checklist','day','stay','asset')),
 encrypted_payload TEXT NOT NULL,
 key_version INTEGER NOT NULL,
 version INTEGER NOT NULL CHECK(version > 0),
 deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
 updated_at TEXT NOT NULL,
 updated_by TEXT NOT NULL REFERENCES members(id),
 PRIMARY KEY(trip_id,id)
);
INSERT INTO records_new SELECT trip_id,id,kind,encrypted_payload,key_version,version,deleted,updated_at,updated_by FROM records;
DROP TABLE records;
ALTER TABLE records_new RENAME TO records;
ALTER TABLE changes ADD COLUMN kind TEXT NOT NULL DEFAULT 'place';
