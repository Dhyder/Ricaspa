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
    await env.VOUCHERS.put(`failed:${ref}`, JSON.stringify({ reason: state }), {
      expirationTtl: 60 * 60 * 24, // keep failure record for a day
    });
    return new Response("OK", { status: 200 });
  }

  if (state !== "COMPLETE") {
    // Some other in-progress state — acknowledge, do nothing further.
    return new Response("OK", { status: 200 });
  }

  // Claim the pending record immediately, before doing any work. If
  // IntaSend sends a duplicate COMPLETE webhook for the same ref (which it
  // can legitimately do), the second call finds nothing here and safely
  // no-ops instead of creating a second voucher.
  const pendingRaw = await env.VOUCHERS.get(`pending:${ref}`);
  if (!pendingRaw) {
    // Either already finalized, already failed, or expired.
    return new Response("OK", { status: 200 });
  }
  await env.VOUCHERS.delete(`pending:${ref}`);

  try {
    const { order } = JSON.parse(pendingRaw);
    const { code, emailWarning } = await finalizeVoucher(env, order);

    await env.VOUCHERS.put(
      `completed:${ref}`,
      JSON.stringify({ code, emailWarning: emailWarning || null }),
      { expirationTtl: 60 * 60 * 24 * 7 } // keep completion record for a week
    );

    return new Response("OK", { status: 200 });
  } catch (err) {
    // We already claimed (deleted) the pending record, so preserve the
    // order details here rather than losing them — this can be manually
    // reprocessed later.
    await env.VOUCHERS.put(`failed:${ref}`, pendingRaw, {
      expirationTtl: 60 * 60 * 24 * 7,
    });
    return new Response("Error: " + String(err), { status: 500 });
  }
}
