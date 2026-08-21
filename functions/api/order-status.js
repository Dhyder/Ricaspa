// GET /api/order-status?ref=REF
//
// Lets the frontend check whether a pending order has been finalized yet.
// Reads explicit state markers written by /api/payment-webhook:
//   completed:REF — payment confirmed, voucher created (returns the code)
//   failed:REF    — payment failed/canceled, or finalization errored
//   pending:REF   — still waiting
//   (none found)  — expired or never existed

import { json } from "../_lib/voucherCore.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref");

  if (!ref) return json({ error: "Missing ref" }, 400);

  const completedRaw = await env.VOUCHERS.get(`completed:${ref}`);
  if (completedRaw) {
    const { code, emailWarning } = JSON.parse(completedRaw);
    return json({ status: "completed", code, emailWarning: emailWarning || null });
  }

  const failedRaw = await env.VOUCHERS.get(`failed:${ref}`);
  if (failedRaw) {
    return json({ status: "failed" });
  }

  const pendingRaw = await env.VOUCHERS.get(`pending:${ref}`);
  if (pendingRaw) {
    return json({ status: "pending" });
  }

  // No record under any state — either it expired (2hr TTL on pending) or
  // the ref was never valid to begin with.
  return json({ status: "unknown" });
}
