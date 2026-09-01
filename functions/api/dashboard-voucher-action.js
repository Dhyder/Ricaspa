import { json } from "../_lib/voucherCore.js";
import { requireRole, audit } from "../_lib/dashboardAuth.js";
import { getOrder, deleteVoucherOrder } from "../_lib/ledger.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  let user;
  try { user = await requireRole(context, "superuser"); }
  catch (err) { return json({ error: err.message === "Forbidden" ? "Superuser access required" : "Not authenticated" }, err.message === "Forbidden" ? 403 : 401); }
  let body; try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const action = String(body.action || "");
  const ref = String(body.ref || "").trim();
  const code = String(body.code || "").trim().toUpperCase();
  if (!ref && !code) return json({ error: "Voucher reference or code is required" }, 400);

  if (action === "delete") {
    if (!ref) return json({ error: "Order reference is required" }, 400);
    const order = await getOrder(env, ref);
    if (!order) return json({ error: "Voucher order not found" }, 404);
    if (order.voucher_code && env.VOUCHERS) {
      await env.VOUCHERS.delete(order.voucher_code);
      await env.VOUCHERS.delete(`voucher-ref:${ref}`);
    }
    await deleteVoucherOrder(env, ref);
    await audit(env, user, "voucher.deleted", "order", ref, { voucherCode: order.voucher_code || null });
    return json({ ok: true, deleted: ref });
  }

  if (action === "redeem") {
    if (!env.VOUCHERS) return json({ error: "Voucher storage is not configured" }, 503);
    const raw = await env.VOUCHERS.get(code);
    if (!raw) return json({ error: "Voucher not found" }, 404);
    const voucher = JSON.parse(raw);
    if (voucher.status === "redeemed") return json({ error: "Voucher is already redeemed", voucher }, 409);
    if (voucher.status !== "unredeemed") return json({ error: `Voucher cannot be redeemed from status: ${voucher.status}` }, 409);
    voucher.status = "redeemed";
    voucher.redeemedAt = new Date().toISOString();
    voucher.redeemedBy = user.email;
    await env.VOUCHERS.put(code, JSON.stringify(voucher));
    const linkedOrder = env.DB ? await env.DB.prepare("SELECT ref FROM orders WHERE voucher_code=?1").bind(code).first() : null;
    if (linkedOrder) await env.DB.prepare("UPDATE orders SET voucher_state='redeemed',updated_at=? WHERE ref=?").bind(new Date().toISOString(), linkedOrder.ref).run();
    await audit(env, user, "voucher.redeemed", "voucher", code, { ref: linkedOrder?.ref || null, offline: true });
    return json({ ok: true, voucher, ref: linkedOrder?.ref || null });
  }

  return json({ error: "Unsupported voucher action" }, 400);
}
