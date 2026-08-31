// POST /api/dashboard-reprocess-payment   body: { ref, outcome? }
// outcome: 'completed' (default) — finalize as a successful payment.
// outcome: 'failed' — mark the order failed instead. Needed because the
// same 401 bug that swallowed COMPLETE webhooks also swallowed FAILED
// ones: an order whose IntaSend collection genuinely failed can be stuck
// forever at payment_state='pending' since the webhook that would have
// moved it to 'failed' never arrived either. Confirm against IntaSend's
// own Transactions/Collection Analysis before using this — it does not
// re-check payment status anywhere itself, it trusts the caller.
//
// Superuser only.

import { json } from "../_lib/voucherCore.js";
import { finalizeVoucher } from "../_lib/voucherCore.js";
import { requireRole, audit } from "../_lib/dashboardAuth.js";
import {
  getOrder,
  claimPaymentForFinalization,
  markFinalizationSuccess,
  markFinalizationFailed,
  markPaymentFailed,
} from "../_lib/ledger.js";

export async function onRequestPost(c) {
  const { request, env } = c;
  let user;
  try {
    user = await requireRole(c, "superuser");
  } catch (e) {
    return json({ error: e.message }, e.message === "Forbidden" ? 403 : 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const ref = (body.ref || "").trim();
  const outcome = body.outcome === "failed" ? "failed" : "completed";
  if (!ref) return json({ error: "Missing ref" }, 400);

  const order = await getOrder(env, ref);
  if (!order) return json({ error: "No order found with that ref" }, 404);

  if (outcome === "failed") {
    if (order.payment_state === "completed") {
      return json({ error: "This order is marked completed (charged) — can't mark it failed. If IntaSend actually shows it failed, that's a real conflict, don't override blindly." }, 409);
    }
    await markPaymentFailed(env, ref, "Manually marked failed via dashboard — confirmed no successful IntaSend transaction for this ref");
    await env.VOUCHERS.delete(`pending:${ref}`);
    await env.VOUCHERS.put(`failed:${ref}`, JSON.stringify({ reason: "manually_marked_failed" }), { expirationTtl: 60 * 60 * 24 });
    await audit(env, user, "payment_manually_marked_failed", "order", ref, {});
    return json({ ok: true, ref, status: "failed" });
  }

  if (order.payment_state !== "completed") {
    return json({
      error: `Order payment_state is '${order.payment_state}', not 'completed' — nothing to reprocess. If the customer says they paid, check IntaSend directly before forcing anything.`,
    }, 400);
  }

  if (order.finalization_state === "completed") {
    return json({ error: "Already finalized", voucherCode: order.voucher_code }, 409);
  }

  // pending:<ref> in KV is what the webhook reads the order payload from.
  // If it's gone (e.g. it expired, or was never written for some other
  // reason), we can't safely mint a voucher without the original order
  // details, so surface that clearly instead of guessing.
  const pendingRaw = await env.VOUCHERS.get(`pending:${ref}`);
  if (!pendingRaw) {
    return json({
      error: "No pending order payload found in KV for this ref (pending:" + ref + ") — can't safely reprocess without it. This needs manual investigation, not a retry.",
    }, 409);
  }

  const claimed = await claimPaymentForFinalization(env, ref);
  if (claimed === false) {
    return json({ error: "Another process already claimed this ref for finalization (possibly a webhook retry that just succeeded) — check the order's current state before retrying." }, 409);
  }

  try {
    const { order: orderPayload } = JSON.parse(pendingRaw);
    const { code, emailWarning } = await finalizeVoucher(env, orderPayload, ref);

    await env.VOUCHERS.put(
      `completed:${ref}`,
      JSON.stringify({ code, emailWarning: emailWarning || null }),
      { expirationTtl: 60 * 60 * 24 * 30 }
    );

    await markFinalizationSuccess(env, ref, code, emailWarning);
    await env.VOUCHERS.delete(`pending:${ref}`);
    await env.VOUCHERS.delete(`failed:${ref}`);

    await audit(env, user, "payment_manually_reprocessed", "order", ref, { voucherCode: code });

    return json({ ok: true, ref, voucherCode: code, emailWarning: emailWarning || null });
  } catch (err) {
    await markFinalizationFailed(env, ref, err);
    return json({ error: "Finalization failed again: " + String(err.message || err) }, 500);
  }
}
