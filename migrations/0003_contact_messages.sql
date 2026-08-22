-- Contact-form submissions from the main site's "Get in Touch" section.
-- Same pattern as `bookings` (0002) — a durable record separate from the
-- transactional email, so a submission isn't lost if the email fails.

CREATE TABLE IF NOT EXISTS contact_messages (
  ref TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  notify_email_state TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at);
