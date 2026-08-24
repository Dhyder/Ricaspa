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

// --- Slot tracker ---------------------------------------------------------

export async function listBookingsByDate(env, date) {
  const database = db(env);
  if (!database) return [];
  const result = await database.prepare(`
    SELECT * FROM bookings WHERE preferred_date = ? ORDER BY preferred_time ASC
  `).bind(date).all();
  return result.results || [];
}

export async function listUpcomingBookings(env, fromDate, limit = 100) {
  const database = db(env);
  if (!database) return [];
  const result = await database.prepare(`
    SELECT * FROM bookings WHERE preferred_date >= ?
    ORDER BY preferred_date ASC, preferred_time ASC LIMIT ?
  `).bind(fromDate, limit).all();
  return result.results || [];
}

const VALID_STATUSES = ["new", "confirmed", "declined", "completed", "no-show"];

export async function updateBookingStatus(env, ref, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  const database = db(env);
  if (!database) throw new Error("No D1 binding — status can't be persisted on this deployment");
  const result = await database.prepare(`
    UPDATE bookings SET status = ?, updated_at = ? WHERE ref = ?
  `).bind(status, new Date().toISOString(), ref).run();
  return result.meta.changes > 0;
}
