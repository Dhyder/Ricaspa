CREATE TABLE IF NOT EXISTS dashboard_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('superuser','employee')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dashboard_users_email ON dashboard_users(email);
CREATE INDEX IF NOT EXISTS idx_dashboard_users_role ON dashboard_users(role);
CREATE INDEX IF NOT EXISTS idx_dashboard_users_status ON dashboard_users(status);
