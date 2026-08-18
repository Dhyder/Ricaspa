// POST /api/create-voucher
//
// TEST MODE ONLY — bypasses real payment entirely. Used while developing/
// testing the voucher + email flow. Real purchases go through
// /api/initiate-payment -> Pesapal checkout -> /api/payment-ipn instead.
//
// Requires (Cloudflare Pages > Settings > Environment variables):
//   RESEND_API_KEY
// Requires (Pages > Settings > Functions > KV bindings):
//   VOUCHERS

import { resolveVoucherOrder, finalizeVoucher, json } from "../_lib/voucherCore.js";

export async function onRequestPost(context) {
  const { request, env } = context;

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
