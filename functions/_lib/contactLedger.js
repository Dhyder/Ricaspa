// D1 helpers for the `contact_messages` table (migration 0003). Same
// degrade-if-no-DB pattern as ledger.js / bookingLedger.js.

function db(env) {
  return env.DB || null;
}

export async function recordContactMessage(env, ref, msg) {
  const database = db(env);
  if (!database) return;
  await database.prepare(`
    INSERT INTO contact_messages (ref, name, email, subject, message, notify_email_state, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).bind(
    ref,
    msg.name,
    msg.email,
    msg.subject || null,
    msg.message,
    new Date().toISOString(),
  ).run();
}

export async function markContactNotifyState(env, ref, state) {
  const database = db(env);
  if (!database) return;
  await database.prepare(`
    UPDATE contact_messages SET notify_email_state = ? WHERE ref = ?
  `).bind(state, ref).run();
}
