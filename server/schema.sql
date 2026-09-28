CREATE TABLE IF NOT EXISTS enrollment_receipts (
 id TEXT PRIMARY KEY,
 fingerprint TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL CHECK(state IN ('sending','queued','failed','uncertain')),
 receipt TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS enrollment_limits (
 bucket TEXT PRIMARY KEY,
 count INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
