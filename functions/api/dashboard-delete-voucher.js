import { json } from "../_lib/voucherCore.js";
import { requireRole, audit } from "../_lib/dashboardAuth.js";

export async function onRequestPost(context) {
  const { env, request } = context;
  let user;
  try { user = await requireRole(context, "superuser"); }
  catch (err) { return json({ error: err.message === "Forbidden" ? "Superuser access required" : "Not authenticated" }, err.message === "Forbidden" ? 403 : 401); }
  if (!env.DB || !env.VOUCHERS) return json({ error: "Voucher storage is not configured" }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request body" }, 400); }
  const ref = String(body.ref || "").trim();
  if (!ref) return json({ error: "Order reference is required" }, 400);

  const order = await env.DB.prepare("SELECT ref, voucher_code, payment_state, voucher_state FROM orders WHERE ref=?1").bind(ref).first();
  if (!order) return json({ error: "Order not found" }, 404);

  // Deletion is intentionally superuser-only and requires an explicit flag so
  // an accidental UI click cannot remove a ledger entry.
  if (body.confirm !== true) return json({ error: "Deletion requires confirm=true" }, 400);

  if (order.voucher_code) await env.VOUCHERS.delete(String(order.voucher_code));
  await env.DB.prepare("DELETE FROM orders WHERE ref=?1").bind(ref).run();
  await audit(env, user, "voucher_deleted", "order", ref, {
    voucherCode: order.voucher_code || null,
    paymentState: order.payment_state,
    voucherState: order.voucher_state,
  });

  return json({ ok: true, ref, deletedBy: { id: user.id, name: user.name, role: user.role } });
}
