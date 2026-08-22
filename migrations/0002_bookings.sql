-- Session-booking requests from the main site's "Book a Session" form.
-- Separate table from `orders` (migration 0001) — bookings aren't payments,
-- they're just a request the customer expects a human to confirm.

CREATE TABLE IF NOT EXISTS bookings (
  ref TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  service TEXT,
  preferred_date TEXT,
  preferred_time TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notify_email_state TEXT NOT NULL DEFAULT 'pending',
  confirmation_email_state TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
