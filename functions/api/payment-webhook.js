// POST /api/payment-webhook
// IntaSend COMPLETE is the authoritative payment-finalization point.
import { finalizeVoucher } from "../_lib/voucherCore.js";
import { claimPaymentForFinalization, markPaymentFailed, markFinalizationSuccess, markFinalizationFailed } from "../_lib/ledger.js";
import { sendTikTokEvent } from "../_lib/tiktokEvents.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  let body; try { body = await request.json(); } catch { return new Response("Invalid body", { status: 400 }); }
  const { challenge, state, api_ref: ref } = body;
  if (challenge !== env.INTASEND_WEBHOOK_CHALLENGE) return new Response("Invalid challenge", { status: 401 });
  if (!ref) return new Response("Missing api_ref", { status: 400 });

  if (state === "FAILED" || state === "CANCELED") {
    await env.VOUCHERS.delete(`pending:${ref}`);
    await markPaymentFailed(env, ref, state);
    await env.VOUCHERS.put(`failed:${ref}`, JSON.stringify({ reason: state }), { expirationTtl: 86400 });
    return new Response("OK");
  }
  if (state !== "COMPLETE") return new Response("OK");

  const d1Claim = await claimPaymentForFinalization(env, ref);
  if (d1Claim === false) return new Response("OK");
  const pendingRaw = await env.VOUCHERS.get(`pending:${ref}`);
  if (!pendingRaw) return new Response("OK");

  try {
    const { order } = JSON.parse(pendingRaw);
    const { code, emailWarning } = await finalizeVoucher(env, order, ref);
    await env.VOUCHERS.put(`completed:${ref}`, JSON.stringify({ code, emailWarning: emailWarning || null }), { expirationTtl: 2592000 });
    await markFinalizationSuccess(env, ref, code, emailWarning);
    await env.VOUCHERS.delete(`pending:${ref}`);
    await env.VOUCHERS.delete(`failed:${ref}`);

    // Purchase is emitted only after payment COMPLETE and voucher finalization.
    // Value and currency are always explicit so TikTok can optimize on revenue.
    await sendTikTokEvent(env, request, {
      event: "Purchase",
      eventId: ref,
      value: Number(order.value),
      currency: "KES",
      email: order.buyerEmail,
      phone: order.buyerPhone,
      externalId: ref,
      pageUrl: new URL("/vouchers.html", request.url).toString(),
      description: order.serviceName || `Gift voucher (${order.type})`,
    }).catch(err => console.error("TikTok Purchase failed", ref, String(err)));

    return new Response("OK", { status: 200 });
  } catch (err) {
    await markFinalizationFailed(env, ref, err);
    await env.VOUCHERS.put(`failed:${ref}`, JSON.stringify({ reason: String(err), retryable: true }), { expirationTtl: 604800 });
    return new Response("Finalization temporarily failed", { status: 500 });
  }
}
