// POST /api/create-voucher
// TEST MODE ONLY — requires X-Test-Secret and testMode=true.
import { resolveVoucherOrder, finalizeVoucher, generateRef, json } from "../_lib/voucherCore.js";
import { recordOrderAttempt, claimPaymentForFinalization, markFinalizationSuccess, markFinalizationFailed } from "../_lib/ledger.js";
import { sendTikTokEvent } from "../_lib/tiktokEvents.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.TEST_MODE_SECRET || request.headers.get("X-Test-Secret") !== env.TEST_MODE_SECRET) return json({ error: "Not authorized" }, 401);
  let body; try { body = await request.json(); } catch { return json({ error: "Invalid request body" }, 400); }
  if (!body.testMode) return json({ error: "This endpoint is test-mode only." }, 400);
  const { error, order } = resolveVoucherOrder(body); if (error) return json({ error }, 400);
  const ref = generateRef();
  try {
    await env.VOUCHERS.put(`pending:${ref}`, JSON.stringify({ order }), { expirationTtl: 7200 });
    await recordOrderAttempt(env, ref, order, "test");
    const claim = await claimPaymentForFinalization(env, ref); if (claim === false) throw new Error("Could not claim synthetic test payment");
    const { code, emailWarning } = await finalizeVoucher(env, order, ref);
    await env.VOUCHERS.put(`completed:${ref}`, JSON.stringify({ code, emailWarning: emailWarning || null }), { expirationTtl: 2592000 });
    await markFinalizationSuccess(env, ref, code, emailWarning);
    await env.VOUCHERS.delete(`pending:${ref}`); await env.VOUCHERS.delete(`failed:${ref}`);
    await sendTikTokEvent(env, request, { event: "Purchase", eventId: ref, value: Number(order.value), currency: "KES", email: order.buyerEmail, phone: order.buyerPhone, externalId: ref, pageUrl: new URL("/vouchers.html", request.url).toString(), description: order.serviceName || `Gift voucher (${order.type})` }).catch(err => console.error("TikTok test Purchase failed", ref, String(err)));
    return json({ success: true, test: true, ref, code, emailWarning: emailWarning || null });
  } catch (err) {
    await markFinalizationFailed(env, ref, err);
    await env.VOUCHERS.put(`failed:${ref}`, JSON.stringify({ reason: String(err), retryable: true }), { expirationTtl: 604800 });
    return json({ error: String(err.message || err), ref }, 500);
  }
}
