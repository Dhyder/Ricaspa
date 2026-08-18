// POST /api/initiate-payment
//
// Real payment flow:
//   1. Validate + resolve the voucher form data
//   2. Ask IntaSend for a checkout URL, and stash the voucher details +
//      IntaSend's checkout_id/signature in KV under a temporary "pending:REF" key
//   3. Frontend redirects the browser there — customer pays via M-Pesa or card
//   4. IntaSend calls /api/payment-webhook when the payment completes, which is
//      what actually finalizes and emails the voucher (not this endpoint)

import { resolveVoucherOrder, generateRef, json } from "../_lib/voucherCore.js";
import { createCheckout } from "../_lib/intasend.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const { error, order } = resolveVoucherOrder(body);
  if (error) return json({ error }, 400);

  const ref = generateRef();

  const description =
    order.type === "amount"
      ? `Rica Spa gift voucher — KES ${order.value}`
      : `Rica Spa voucher — ${order.serviceName}`;

  try {
    const checkout = await createCheckout(env, {
      ref,
      amount: Number(order.value),
      description,
      callbackUrl: `https://ricaspa.beauty/vouchers?ref=${ref}`,
      billing: {
        email: order.buyerEmail,
        phone: order.buyerPhone,
        name: order.buyerName,
      },
    });

    // Stash the voucher details + IntaSend's checkout reference together,
    // so both the webhook and the status-poll endpoint can find everything
    // they need under one key.
    await env.VOUCHERS.put(
      `pending:${ref}`,
      JSON.stringify({
        order,
        checkoutId: checkout.id,
        signature: checkout.signature,
      }),
      { expirationTtl: 60 * 60 * 2 } // pending orders expire after 2 hours if unpaid
    );

    return json({ success: true, ref, redirectUrl: checkout.url });
  } catch (err) {
    return json({ error: "Could not start payment", detail: String(err) }, 500);
  }
}
