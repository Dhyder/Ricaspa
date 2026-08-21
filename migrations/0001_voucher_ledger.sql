CREATE TABLE IF NOT EXISTS orders (
  ref TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  value INTEGER NOT NULL,
  service_name TEXT,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,
  gifting_others INTEGER NOT NULL DEFAULT 0,
  to_name TEXT,
  recipient_email TEXT,
  from_name TEXT,
  message TEXT,
  payment_provider TEXT NOT NULL DEFAULT 'intasend',
  payment_state TEXT NOT NULL DEFAULT 'pending',
  finalization_state TEXT NOT NULL DEFAULT 'pending',
  voucher_state TEXT NOT NULL DEFAULT 'pending',
  email_state TEXT NOT NULL DEFAULT 'pending',
  voucher_code TEXT,
  failure_reason TEXT,
  email_warning TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payment_completed_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_state ON orders(payment_state);
CREATE INDEX IF NOT EXISTS idx_orders_service_name ON orders(service_name);
CREATE INDEX IF NOT EXISTS idx_orders_voucher_code ON orders(voucher_code);

CREATE TABLE IF NOT EXISTS email_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_ref TEXT NOT NULL,
  email_type TEXT NOT NULL,
  recipient TEXT,
  status TEXT NOT NULL,
  provider_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_ref) REFERENCES orders(ref)
);

CREATE INDEX IF NOT EXISTS idx_email_events_order_ref ON email_events(order_ref);
