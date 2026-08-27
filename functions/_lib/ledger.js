// D1 transaction ledger helpers.
//
// D1 is the durable transaction/audit ledger. KV remains the fast operational
// store for voucher-code lookup and the pending/completed browser flow.

function db(env) {
  return env.DB || null;
}

export async function recordOrderAttempt(env, ref, order, paymentProvider = 'intasend') {
  const database = db(env);
  if (!database) return;

  const now = new Date().toISOString();
  await database.prepare(`
    INSERT INTO orders (
      ref, type, value, service_name, buyer_name, buyer_email, buyer_phone,
      gifting_others, to_name, recipient_email, from_name, message,
      payment_provider, payment_state, finalization_state, voucher_state,
      email_state, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'pending', 'pending', ?, ?)
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
    paymentProvider,
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
// COMPLETE webhook for a pending row gets changes > 0. If finalization later
// fails, markFinalizationFailed() returns the row to pending so an IntaSend
// retry can safely resume without issuing a second voucher.
export async function claimPaymentForFinalization(env, ref) {
  const database = db(env);
  if (!database) return null;

  const now = new Date().toISOString();
  const result = await database.prepare(`
    UPDATE orders
    SET payment_state = 'completed', finalization_state = 'processing',
        payment_completed_at = COALESCE(payment_completed_at, ?), updated_at = ?
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
  // Keep payment_state=completed: the customer did pay. Return only the
  // finalization claim to pending so a webhook retry can resume safely.
  await database.prepare(`
    UPDATE orders
    SET finalization_state = 'pending',
        failure_reason = ?, updated_at = ?
    WHERE ref = ?
  `).bind(String(reason || 'Finalization failed'), now, ref).run();
}

export async function recordEmailEvent(env, ref, emailType, recipient, status, providerId, error) {
  const database = db(env);
  if (!ref) return;
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

export async function getOrder(env, ref) {
  const database = db(env);
  if (!database) return null;
  return database.prepare(`SELECT * FROM orders WHERE ref = ?`).bind(ref).first();
}

// --- Dashboard read queries ------------------------------------------------

export async function listOrders(env, { from, to, limit = 200 } = {}) {
  const database = db(env);
  if (!database) return [];
  const clauses = [];
  const binds = [];
  if (from) { clauses.push('created_at >= ?'); binds.push(from); }
  if (to) { clauses.push('created_at <= ?'); binds.push(to); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const stmt = database.prepare(
    `SELECT ref, type, value, service_name, buyer_name, buyer_email, payment_state,
            finalization_state, voucher_code, created_at, payment_completed_at
     FROM orders ${where} ORDER BY created_at DESC LIMIT ?`
  ).bind(...binds, limit);
  const { results } = await stmt.all();
  return results || [];
}

// Revenue + counts, bucketed by day, for completed (paid) voucher orders only.
export async function getStatsSummary(env, { from, to } = {}) {
  const database = db(env);
  if (!database) return { totalRevenue: 0, totalOrders: 0, byDay: [], byService: [] };

  const clauses = ["payment_state = 'completed'"];
  const binds = [];
  if (from) { clauses.push('created_at >= ?'); binds.push(from); }
  if (to) { clauses.push('created_at <= ?'); binds.push(to); }
  const where = `WHERE ${clauses.join(' AND ')}`;

  const totals = await database.prepare(
    `SELECT COUNT(*) AS totalOrders, COALESCE(SUM(value), 0) AS totalRevenue FROM orders ${where}`
  ).bind(...binds).first();

  const byDayRes = await database.prepare(
    `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS orders, COALESCE(SUM(value), 0) AS revenue
     FROM orders ${where} GROUP BY day ORDER BY day ASC`
  ).bind(...binds).all();

  const byServiceRes = await database.prepare(
    `SELECT COALESCE(service_name, 'Voucher (no service tied)') AS service, COUNT(*) AS orders, COALESCE(SUM(value), 0) AS revenue
     FROM orders ${where} GROUP BY service ORDER BY revenue DESC`
  ).bind(...binds).all();

  return {
    totalOrders: totals?.totalOrders || 0,
    totalRevenue: totals?.totalRevenue || 0,
    byDay: byDayRes.results || [],
    byService: byServiceRes.results || [],
  };
}
