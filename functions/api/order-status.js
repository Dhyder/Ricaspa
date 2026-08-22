// GET /api/order-status?ref=REF
//
// D1 is authoritative when available. KV remains the fast fallback and stores
// the voucher record/code used by the browser flow.

import { getOrder } from "../_lib/ledger.js";
import { json } from "../_lib/voucherCore.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref");

  if (!ref) return json({ error: "Missing ref" }, 400);

  const order = await getOrder(env, ref);
  if (order) {
    if (order.finalization_state === "completed") {
      return json({
        status: "completed",
        code: order.voucher_code || undefined,
        emailWarning: order.email_warning || null,
        emailState: order.email_state || null,
      });
    }

    if (order.payment_state === "failed" || order.finalization_state === "failed") {
      return json({ status: "failed" });
    }

    if (order.payment_state === "completed" && order.finalization_state === "pending") {
      return json({ status: "pending", paymentConfirmed: true });
    }

    return json({ status: "pending" });
  }

  // Legacy/fallback path if DB is unavailable or an older order predates D1.
  const completedRaw = await env.VOUCHERS.get(`completed:${ref}`);
  if (completedRaw) {
    const { code, emailWarning } = JSON.parse(completedRaw);
    return json({ status: "completed", code, emailWarning: emailWarning || null });
  }

  const failedRaw = await env.VOUCHERS.get(`failed:${ref}`);
  if (failedRaw) return json({ status: "failed" });

  const pendingRaw = await env.VOUCHERS.get(`pending:${ref}`);
  if (pendingRaw) return json({ status: "pending" });

  return json({ status: "unknown" });
}
