import { json, verifyVoucherSignature } from "../_lib/voucherCore.js";
import { requireSession, audit } from "../_lib/dashboardAuth.js";

export async function onRequestPost(context) {
  let user;
  try { user = await requireSession(context); } catch { return json({ error: "Not authorized" }, 401); }
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request body" }, 400); }
  const code = String(body.code || "").trim().toUpperCase();
  const action = body.action === "redeem" ? "redeem" : "lookup";
  const signature = body.signature ? String(body.signature).trim() : null;
  if (!code) return json({ error: "Missing code" }, 400);
  if (signature) {
    const valid = await verifyVoucherSignature(env, code, signature);
    if (valid === false) return json({ error: "QR signature invalid — this code may have been altered or fabricated" }, 400);
  }
  const raw = await env.VOUCHERS.get(code);
  if (!raw) return json({ error: "Voucher code not found" }, 404);
  const record = JSON.parse(raw);
  if (action === "lookup") return json({ voucher: record });
  if (record.status === "redeemed") return json({ error: "Already redeemed", voucher: record }, 409);
  if (new Date(record.expiresAt) < new Date()) return json({ error: "Voucher has expired", voucher: record }, 410);
  record.status = "redeemed";
  record.redeemedAt = new Date().toISOString();
  record.redeemedBy = user.id;
  await env.VOUCHERS.put(code, JSON.stringify(record));
  await audit(env, user, "voucher_redeemed", "voucher", code);
  return json({ voucher: record, actedBy: { id: user.id, name: user.name, role: user.role } });
}
