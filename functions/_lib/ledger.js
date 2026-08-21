// D1 transaction ledger helpers.
//
// D1 is intentionally an audit/reporting ledger alongside KV, not a
// replacement for the fast voucher-code lookup in VOUCHERS.
//
// Until the D1 binding is added in Cloudflare, these helpers safely no-op so
// the existing KV payment path remains deployable. Once env.DB is bound,
// every purchase attempt is recorded and payment/finalization states are
// updated here.

function db(env) {
  return env.DB || null;
}

export async function recordOrderAttempt(env, ref, order) {
  const database = db(env);
  if (!database) return;

  const now = new Date().toISOString();
  await database.prepare(`
    INSERT INTO orders (
      ref, type, value, service_name, buyer_name, buyer_email, buyer_phone,
      gifting_others, to_name, recipient_email, from_name, message,
      payment_provider, payment_state, finalization_state, voucher_state,
      email_state, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'intasend', 'pending', 'pending', 'pending', 'pending', ?, ?)
  `).bind(
    ref,
    order.type,
    Number(order.value),
    order.serviceName,
    order.buyerName,
    order.buyerEmail,
    order.buyerPhone || null,
    order.giftingOthers ? 1 : 0,
    order.toName || null,
    order.recipientEmail || null,
    order.fromName || null,
    order.message || null,
    now,
    now,
  ).run();
}

export async function markPaymentFailed(env, ref, reason) {
  const database = db(env);
  if (!database) return;

  const now = new Date().toISOString();
  await database.prepare(`
    UPDATE orders
    SET payment_state = 'failed', finalization_state = 'failed',
        failure_reason = ?, updated_at = ?
    WHERE ref = ?
  `).bind(String(reason || 'FAILED'), now, ref).run();
}

// Atomically claims a successful payment for finalization. Only the first
// COMPLETE webhook for a pending row gets changes > 0.
export async function claimPaymentForFinalization(env, ref) {
  const database = db(env);
  if (!database) return null;

  const now = new Date().toISOString();
  const result = await database.prepare(`
    UPDATE orders
    SET payment_state = 'completed', finalization_state = 'processing',
        payment_completed_at = ?, updated_at = ?
    WHERE ref = ? AND finalization_state = 'pending'
  `).bind(now, now, ref).run();

  return result.meta?.changes > 0;
}

export async function markFinalizationSuccess(env, ref, code, emailWarning) {
  const database = db(env);
  if (!database) return;

  const now = new Date().toISOString();
  const emailState = emailWarning ? 'partial' : 'sent';
  await database.prepare(`
    UPDATE orders
    SET finalization_state = 'completed', voucher_state = 'issued',
        email_state = ?, voucher_code = ?, email_warning = ?,
        completed_at = ?, updated_at = ?
    WHERE ref = ?
  `).bind(
    emailState,
    code,
    emailWarning || null,
    now,
    now,
    ref,
  ).run();
}

export async function markFinalizationFailed(env, ref, reason) {
  const database = db(env);
  if (!database) return;

  const now = new Date().toISOString();
  await database.prepare(`
    UPDATE orders
    SET finalization_state = 'failed', voucher_state = 'failed',
        email_state = 'failed', failure_reason = ?, updated_at = ?
    WHERE ref = ?
  `).bind(String(reason || 'Finalization failed'), now, ref).run();
}

export async function recordEmailEvent(env, ref, emailType, recipient, status, providerId, error) {
  const database = db(env);
  if (!database) return;

  await database.prepare(`
    INSERT INTO email_events
      (order_ref, email_type, recipient, status, provider_id, error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    ref,
    emailType,
    recipient || null,
    status,
    providerId || null,
    error || null,
    new Date().toISOString(),
  ).run();
}
