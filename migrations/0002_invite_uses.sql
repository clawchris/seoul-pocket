-- Small-group invites: one code, reusable until it expires or the owner rotates it.
ALTER TABLE invites ADD COLUMN uses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invites ADD COLUMN max_uses INTEGER NOT NULL DEFAULT 12;
ALTER TABLE members ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN last_seen_at TEXT;
