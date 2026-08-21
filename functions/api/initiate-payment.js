// POST /api/initiate-payment
//
// IMPORTANT: this endpoint does NOT call IntaSend directly. Cloudflare
// Workers share outbound IPs across all Workers customers, and IntaSend's
// own Cloudflare firewall is blocking that shared IP range (Cloudflare
// error 1106 — confirmed via direct testing). Rather than wait on IntaSend
// support to whitelist it, the checkout-creation call happens client-side
// instead, using the browser's own IP. The publishable key is safe to
// expose in the browser — that's what "publishable" means.
//
// Real payment flow:
//   1. Validate + resolve the voucher form data
//   2. Stash the voucher details in KV under a temporary "pending:REF" key
//   3. Return the ref + publishable key to the browser
//   4. Browser calls IntaSend's checkout API directly, gets a redirect URL,
//      and sends the customer there
//   5. IntaSend calls /api/payment-webhook when payment completes — that
//      inbound direction isn't blocked, only our outbound calls to them are

import { resolveVoucherOrder, generateRef, json } from "../_lib/voucherCore.js";
import { recordOrderAttempt } from "../_lib/ledger.js";

// Basic abuse deterrent: max 8 order attempts per IP per 10 minutes. This
// isn't perfectly precise under concurrent requests (KV is eventually
// consistent, not transactional), but it's enough to stop casual spam/bots
// flooding KV with junk pending orders. For stronger protection, Cloudflare's
// own dashboard-level Rate Limiting Rules (Security > WAF) can be layered on
// top without touching code.
async function isRateLimited(env, ip) {
  const key = `ratelimit:${ip}`;
  const current = await env.VOUCHERS.get(key);
  const count = current ? parseInt(current, 10) : 0;
  if (count >= 8) return true;
  await env.VOUCHERS.put(key, String(count + 1), { expirationTtl: 600 });
  return false;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (await isRateLimited(env, ip)) {
    return json({ error: "Too many attempts. Please wait a few minutes and try again." }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const { error, order } = resolveVoucherOrder(body);
  if (error) return json({ error }, 400);

  const ref = generateRef();

  try {
    await env.VOUCHERS.put(
      `pending:${ref}`,
      JSON.stringify({ order }),
      { expirationTtl: 60 * 60 * 2 } // pending orders expire after 2 hours if unpaid
    );
  } catch (err) {
    return json({ error: "Could not start order", detail: String(err) }, 500);
  }

  try {
    await recordOrderAttempt(env, ref, order);
  } catch (err) {
    // If D1 is configured, do not allow a payment attempt to proceed without
    // a ledger row. If D1 is not configured yet, recordOrderAttempt is a no-op.
    await env.VOUCHERS.delete(`pending:${ref}`);
    return json({ error: "Could not record order", detail: String(err) }, 500);
  }

  const description =
    order.type === "amount"
      ? `Rica Spa gift voucher — KES ${order.value}`
      : `Rica Spa voucher — ${order.serviceName}`;

  return json({
    success: true,
    ref,
    publishableKey: env.INTASEND_PUBLISHABLE_KEY,
    checkoutPayload: {
      amount: Number(order.value),
      currency: "KES",
      api_ref: ref,
      redirect_url: `https://ricaspa.beauty/vouchers?ref=${ref}`,
      email: order.buyerEmail,
      phone_number: order.buyerPhone || "",
      first_name: order.buyerName,
      comment: description,
    },
  });
}
