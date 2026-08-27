-- Repair migration for production databases where 0004 was recorded as applied
-- but only dashboard_users was created.
CREATE TABLE IF NOT EXISTS dashboard_sessions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL,last_seen_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS dashboard_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT REFERENCES dashboard_users(id) ON DELETE SET NULL,action TEXT NOT NULL,entity_type TEXT,entity_id TEXT,metadata TEXT,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_dashboard_sessions_user ON dashboard_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_sessions_expires ON dashboard_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_dashboard_audit_created ON dashboard_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_dashboard_audit_user ON dashboard_audit_log(user_id);
