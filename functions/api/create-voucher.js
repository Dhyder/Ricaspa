// POST /api/create-voucher
//
// TEST MODE ONLY — bypasses real payment entirely. Used while developing/
// testing the voucher + email flow. Real purchases go through
// /api/initiate-payment -> IntaSend checkout -> /api/payment-webhook instead.
//
// SECURITY: this endpoint mints real vouchers with no payment involved, so
// it requires a shared secret header. Without this, anyone who finds this
// URL could generate free vouchers indefinitely. There is deliberately no
// UI for this on the public site — trigger it yourself via curl.
//
// Example:
//   curl -s -X POST https://ricaspa.beauty/api/create-voucher \
//     -H "Content-Type: application/json" \
//     -H "X-Test-Secret: YOUR_SECRET" \
//     -d '{"type":"amount","value":"2000","buyerName":"Test","buyerEmail":"you@email.com","giftingOthers":false,"testMode":true}'
//
// Requires (Cloudflare Pages > Settings > Environment variables):
//   RESEND_API_KEY
//   TEST_MODE_SECRET   — any string you choose, keep it private
// Requires (Pages > Settings > Functions > KV bindings):
//   VOUCHERS

import { resolveVoucherOrder, finalizeVoucher, json } from "../_lib/voucherCore.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const providedSecret = request.headers.get("X-Test-Secret");
  if (!env.TEST_MODE_SECRET || providedSecret !== env.TEST_MODE_SECRET) {
    return json({ error: "Not authorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  if (!body.testMode) {
    return json(
      { error: "This endpoint is test-mode only. Use /api/initiate-payment for real purchases." },
      400
    );
  }

  const { error, order } = resolveVoucherOrder(body);
  if (error) return json({ error }, 400);

  try {
    const { code } = await finalizeVoucher(env, order);
    return json({ success: true, code });
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
}
