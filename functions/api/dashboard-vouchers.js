import { json, verifyVoucherSignature } from "../_lib/voucherCore.js";
import { requireSession, audit } from "../_lib/dashboardAuth.js";

export async function onRequestGet(c) {
  try {
    await requireSession(c);
    if (!c.env.VOUCHERS) return json({ vouchers: [], error: "Voucher storage is not configured" }, 503);
    const out = [];
    let cursor;
    do {
      const page = await c.env.VOUCHERS.list({ cursor, limit: 1000 });
      for (const key of page.keys || []) {
        if (key.name.startsWith("voucher-ref:")) continue;
        const raw = await c.env.VOUCHERS.get(key.name);
        if (!raw) continue;
        try {
          const v = JSON.parse(raw);
          out.push({
            code: v.code || key.name,
            ref: v.ref || null,
            buyerName: v.buyerName || null,
            buyerEmail: v.buyerEmail || null,
            buyerPhone: v.buyerPhone || null,
            toName: v.toName || null,
            serviceName: v.serviceName || null,
            type: v.type || null,
            value: v.value ?? null,
            status: v.status || "unredeemed",
            createdAt: v.createdAt || null,
            expiresAt: v.expiresAt || null,
            redeemedAt: v.redeemedAt || null,
            redeemedBy: v.redeemedBy || null,
          });
        } catch {}
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    out.sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return json({ vouchers: out });
  } catch (e) {
    return json({ error: e.message }, e.message === "Forbidden" ? 403 : 401);
  }
}

// POST /api/dashboard-vouchers   body: { code, action: 'lookup'|'redeem', signature? }
// Session-protected (any active dashboard user, not just superuser) —
// this is the dashboard's replacement for staff-vouchers.html's redeem
// action. Every redeem is written to dashboard_audit_log with the acting
// user, unlike the old X-Staff-Secret flow which had no per-user trail.
export async function onRequestPost(c) {
  let user;
  try {
    user = await requireSession(c);
  } catch (e) {
    return json({ error: e.message }, 401);
  }

  const { request, env } = c;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const code = (body.code || "").trim().toUpperCase();
  const action = body.action === "redeem" ? "redeem" : "lookup";
  const signature = body.signature ? String(body.signature).trim() : null;

  if (!code) return json({ error: "Missing code" }, 400);
  if (!env.VOUCHERS) return json({ error: "Voucher storage is not configured" }, 503);

  if (signature) {
    const valid = await verifyVoucherSignature(env, code, signature);
    if (valid === false) {
      return json({ error: "QR signature invalid — this code may have been altered or fabricated" }, 400);
    }
  }

  const raw = await env.VOUCHERS.get(code);
  if (!raw) return json({ error: "Voucher code not found" }, 404);

  const record = JSON.parse(raw);

  if (action === "lookup") return json({ voucher: record });

  if (record.status === "redeemed") {
    return json({ error: "Already redeemed", voucher: record }, 409);
  }

  const expiresAt = new Date(record.expiresAt);
  if (expiresAt < new Date()) {
    return json({ error: "Voucher has expired", voucher: record }, 410);
  }

  record.status = "redeemed";
  record.redeemedAt = new Date().toISOString();
  record.redeemedBy = user.name || user.email;
  await env.VOUCHERS.put(code, JSON.stringify(record));

  await audit(env, user, "voucher_redeemed", "voucher", code, { buyerEmail: record.buyerEmail || null });

  return json({ voucher: record });
}
