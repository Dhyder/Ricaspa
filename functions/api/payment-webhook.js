// POST /api/payment-webhook
//
// IntaSend's COMPLETE webhook is the authoritative payment-finalization point.
// D1 claims the order first, preventing concurrent duplicate COMPLETE events
// from issuing multiple vouchers. KV keeps the operational voucher records.

import { finalizeVoucher } from "../_lib/voucherCore.js";
import {
  claimPaymentForFinalization,
  markPaymentFailed,
  markFinalizationSuccess,
  markFinalizationFailed,
} from "../_lib/ledger.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid body", { status: 400 });
  }

  const { challenge, state, api_ref: ref } = body;

  if (challenge !== env.INTASEND_WEBHOOK_CHALLENGE) {
    return new Response("Invalid challenge", { status: 401 });
  }

  if (!ref) return new Response("Missing api_ref", { status: 400 });

  if (state === "FAILED" || state === "CANCELED") {
    await env.VOUCHERS.delete(`pending:${ref}`);
    await markPaymentFailed(env, ref, state);
    await env.VOUCHERS.put(`failed:${ref}`, JSON.stringify({ reason: state }), {
      expirationTtl: 60 * 60 * 24,
    });
    return new Response("OK", { status: 200 });
  }

  if (state !== "COMPLETE") {
    return new Response("OK", { status: 200 });
  }

  // D1 is authoritative when configured. A false claim means another webhook
  // already owns or completed this ref; acknowledge the retry without doing
  // anything twice. The null result is the legacy/no-D1 path.
  const d1Claim = await claimPaymentForFinalization(env, ref);
  if (d1Claim === false) return new Response("OK", { status: 200 });

  const pendingRaw = await env.VOUCHERS.get(`pending:${ref}`);
  if (!pendingRaw) {
    // D1 may already know this order, but KV can be absent after a prior
    // successful attempt. A duplicate is still safe to acknowledge.
    return new Response("OK", { status: 200 });
  }

  try {
    const { order } = JSON.parse(pendingRaw);
    const { code, emailWarning } = await finalizeVoucher(env, order, ref);

    await env.VOUCHERS.put(
      `completed:${ref}`,
      JSON.stringify({ code, emailWarning: emailWarning || null }),
      { expirationTtl: 60 * 60 * 24 * 30 }
    );

    await markFinalizationSuccess(env, ref, code, emailWarning);
    await env.VOUCHERS.delete(`pending:${ref}`);
    await env.VOUCHERS.delete(`failed:${ref}`);
    return new Response("OK", { status: 200 });
  } catch (err) {
    // Keep the pending order available for a future IntaSend retry. D1 also
    // moves finalization_state back to pending, while preserving payment_state
    // as completed. The voucher-ref:<ref> anchor means a retry reuses an
    // already-created voucher rather than minting a second one.
    await markFinalizationFailed(env, ref, err);
    await env.VOUCHERS.put(`failed:${ref}`, JSON.stringify({
      reason: String(err),
      retryable: true,
    }), { expirationTtl: 60 * 60 * 24 * 7 });
    return new Response("Finalization temporarily failed", { status: 500 });
  }
}
