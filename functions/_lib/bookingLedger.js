// D1 helpers for the `bookings` table (migration 0002). Same pattern as
// ledger.js: every function is a safe no-op if `DB` isn't bound yet, so a
// deployment that hasn't run the migration/added the binding still lets
// bookings through — they just aren't recorded in D1 (the Resend emails
// still fire either way, so nothing is silently lost).

function db(env) {
  return env.DB || null;
}

export async function recordBooking(env, ref, booking) {
  const database = db(env);
  if (!database) return;

  const now = new Date().toISOString();
  await database.prepare(`
    INSERT INTO bookings (
      ref, name, email, phone, service, preferred_date, preferred_time,
      message, status, notify_email_state, confirmation_email_state,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', 'pending', 'pending', ?, ?)
  `).bind(
    ref,
    booking.name,
    booking.email,
    booking.phone || null,
    booking.service || null,
    booking.date || null,
    booking.time || null,
    booking.message || null,
    now,
    now,
  ).run();
}

export async function markNotifyEmailState(env, ref, state) {
  const database = db(env);
  if (!database) return;
  await database.prepare(`
    UPDATE bookings SET notify_email_state = ?, updated_at = ? WHERE ref = ?
  `).bind(state, new Date().toISOString(), ref).run();
}

export async function markConfirmationEmailState(env, ref, state) {
  const database = db(env);
  if (!database) return;
  await database.prepare(`
    UPDATE bookings SET confirmation_email_state = ?, updated_at = ? WHERE ref = ?
  `).bind(state, new Date().toISOString(), ref).run();
}

export async function getBooking(env, ref) {
  const database = db(env);
  if (!database) return null;
  return database.prepare(`SELECT * FROM bookings WHERE ref = ?`).bind(ref).first();
}
