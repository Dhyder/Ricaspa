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

  if (state !== "COMPLETE") {
    // Not paid yet (or failed/canceled) — acknowledge, do nothing further.
    return new Response("OK", { status: 200 });
  }

  try {
    const pendingRaw = await env.VOUCHERS.get(`pending:${ref}`);
    if (!pendingRaw) {
      // Either already finalized (IntaSend can retry webhook calls) or expired.
      return new Response("OK", { status: 200 });
    }

    const { order } = JSON.parse(pendingRaw);
    await finalizeVoucher(env, order);

    // Remove the pending record so a duplicate webhook call doesn't double-send.
    await env.VOUCHERS.delete(`pending:${ref}`);

    return new Response("OK", { status: 200 });
  } catch (err) {
    return new Response("Error: " + String(err), { status: 500 });
  }
}
