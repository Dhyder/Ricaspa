-- Dashboard user storage
-- Keeps dashboard identities in D1 so the dashboard can authenticate and
-- persist users independently of the voucher KV store.

CREATE TABLE IF NOT EXISTS dashboard_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dashboard_users_email
  ON dashboard_users(email);
