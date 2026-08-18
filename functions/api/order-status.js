// GET /api/order-status?ref=REF
//
// Lets the frontend check whether a pending order has been finalized yet.
// Used on the vouchers page after the customer is redirected back from
// IntaSend's checkout, since the actual finalization happens async via the
// webhook.

import { json } from "../_lib/voucherCore.js";
import { checkStatus } from "../_lib/intasend.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref");

  if (!ref) return json({ error: "Missing ref" }, 400);

  const pendingRaw = await env.VOUCHERS.get(`pending:${ref}`);

  if (!pendingRaw) {
    // No longer pending — either finalized already, or never existed/expired.
    return json({ status: "completed" });
  }

  // Still pending in our KV. Double check directly with IntaSend in case the
  // webhook hasn't landed yet — covers the case where the customer's browser
  // gets back before the webhook does.
  try {
    const { checkoutId, signature } = JSON.parse(pendingRaw);
    const result = await checkStatus(env, { checkoutId, signature });
    const state = result?.invoice?.state;

    if (state === "FAILED" || state === "CANCELED") {
      return json({ status: "failed" });
    }
  } catch {
    // Fall through to "pending" if the status check itself fails.
  }

  return json({ status: "pending" });
}
