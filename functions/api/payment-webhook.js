// POST /api/payment-webhook
//
// IntaSend calls this automatically when a payment's state changes, once
// you've configured this URL (and a matching "challenge" string) in the
// IntaSend dashboard under Webhooks. This is the authoritative finalization
// point — don't rely on the browser redirect back to the site, since the
// customer might close the tab before that happens.
//
// Setup: dashboard > Webhooks > set destination URL to
// https://ricaspa.beauty/api/payment-webhook, and set a challenge string —
// put that same string in the INTASEND_WEBHOOK_CHALLENGE env var here.
//
// IDEMPOTENCY: IntaSend can call this more than once for the same payment
// (retries). The pending record is claimed (deleted) BEFORE we attempt to
// finalize, so a duplicate call finds nothing left to process and safely
// no-ops. If finalization itself fails after claiming, the order details
// are preserved under "failed:REF" instead of being lost, so they can be
// manually recovered.
//
// ORDER STATES (used by /api/order-status):
//   pending:REF   — order started, payment not yet confirmed
//   completed:REF — payment confirmed, voucher created (value = the code)
//   failed:REF    — payment failed/canceled, or finalization errored

import { finalizeVoucher } from "../_lib/voucherCore.js";
import { claimPaymentForFinalization, markPaymentFailed, markFinalizationSuccess, markFinalizationFailed } from "../_lib/ledger.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid body", { status: 400 });
  }

  const { challenge, state, api_ref: ref } = body;

  // Verify this request actually came from IntaSend, not just anyone who
  // found the URL.
  if (challenge !== env.INTASEND_WEBHOOK_CHALLENGE) {
    return new Response("Invalid challenge", { status: 401 });
  }

  if (!ref) {
    return new Response("Missing api_ref", { status: 400 });
  }

  if (state === "FAILED" || state === "CANCELED") {
    // Record the failure so order-status can tell the customer honestly,
    // instead of leaving them polling "pending" until it expires.
    await env.VOUCHERS.delete(`pending:${ref}`);
    await markPaymentFailed(env, ref, state);
    await env.VOUCHERS.put(`failed:${ref}`, JSON.stringify({ reason: state }), {
      expirationTtl: 60 * 60 * 24, // keep failure record for a day
    });
    return new Response("OK", { status: 200 });
  }

  if (state !== "COMPLETE") {
    // Some other in-progress state — acknowledge, do nothing further.
    return new Response("OK", { status: 200 });
  }

  // If D1 is configured, it is the atomic claim for finalization. This
  // closes the race where two COMPLETE webhooks arrive together and both
  // read the same KV pending record before either deletes it.
  const d1Claim = await claimPaymentForFinalization(env, ref);
  if (d1Claim === false) {
    return new Response("OK", { status: 200 });
  }

  // KV remains the source of the actual order payload and voucher lookup.
  // Claim it before finalization when D1 is not configured, preserving the
  // existing safe behavior until the ledger binding is enabled.
  const pendingRaw = await env.VOUCHERS.get(`pending:${ref}`);
  if (!pendingRaw) {
    return new Response("OK", { status: 200 });
  }
  await env.VOUCHERS.delete(`pending:${ref}`);

  try {
    const { order } = JSON.parse(pendingRaw);
    const { code, emailWarning } = await finalizeVoucher(env, order);

    await env.VOUCHERS.put(
      `completed:${ref}`,
      JSON.stringify({ code, emailWarning: emailWarning || null }),
      { expirationTtl: 60 * 60 * 24 * 7 }
    );

    await markFinalizationSuccess(env, ref, code, emailWarning);
    return new Response("OK", { status: 200 });
  } catch (err) {
    await env.VOUCHERS.put(`failed:${ref}`, pendingRaw, {
      expirationTtl: 60 * 60 * 24 * 7,
    });
    await markFinalizationFailed(env, ref, err);
    return new Response("Error: " + String(err), { status: 500 });
  }
}
