// POST /api/create-voucher
//
// TEST MODE ONLY — bypasses real payment entirely. This endpoint deliberately
// creates a synthetic *completed* order so the production voucher, KV, Resend,
// and D1 ledger paths can be exercised without spending money.
//
// SECURITY: this endpoint mints real vouchers with no payment involved, so it
// requires a shared secret header. There is deliberately no public UI for it.

import {
  resolveVoucherOrder,
  finalizeVoucher,
  generateRef,
  json,
} from "../_lib/voucherCore.js";
import {
  recordOrderAttempt,
  claimPaymentForFinalization,
  markFinalizationSuccess,
  markFinalizationFailed,
} from "../_lib/ledger.js";

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

  const ref = generateRef();

  try {
    // Mirror the real payment path: create the pending order in KV and the
    // transaction row in D1 before finalization begins.
    await env.VOUCHERS.put(
      `pending:${ref}`,
      JSON.stringify({ order }),
      { expirationTtl: 60 * 60 * 2 }
    );

    await recordOrderAttempt(env, ref, order, "test");

    // Mark the synthetic payment as completed and claim finalization exactly
    // as the real IntaSend COMPLETE webhook does.
    const claim = await claimPaymentForFinalization(env, ref);
    if (claim === false) {
      throw new Error("Could not claim synthetic test payment");
    }

    const { code, emailWarning } = await finalizeVoucher(env, order, ref);

    await env.VOUCHERS.put(
      `completed:${ref}`,
      JSON.stringify({ code, emailWarning: emailWarning || null }),
      { expirationTtl: 60 * 60 * 24 * 30 }
    );

    await markFinalizationSuccess(env, ref, code, emailWarning);
    await env.VOUCHERS.delete(`pending:${ref}`);
    await env.VOUCHERS.delete(`failed:${ref}`);

    return json({
      success: true,
      test: true,
      ref,
      code,
      emailWarning: emailWarning || null,
    });
  } catch (err) {
    await markFinalizationFailed(env, ref, err);
    await env.VOUCHERS.put(
      `failed:${ref}`,
      JSON.stringify({ reason: String(err), retryable: true }),
      { expirationTtl: 60 * 60 * 24 * 7 }
    );

    return json({
      error: String(err.message || err),
      ref,
    }, 500);
  }
}
