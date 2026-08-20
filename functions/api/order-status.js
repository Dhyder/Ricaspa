// GET /api/order-status?ref=REF
//
// Lets the frontend check whether a pending order has been finalized yet.
//
// This intentionally does NOT call IntaSend's status API — that would be
// another outbound call from the Worker, which is blocked by IntaSend's
// firewall (same root cause as initiate-payment.js). Instead, this just
// checks our own KV: the webhook (/api/payment-webhook) is what actually
// finalizes orders and deletes the "pending:REF" key, so its absence means
// either it's done, or it never happened. We can't distinguish a genuine
// failure from "still pending" this way, but pending orders expire after 2
// hours anyway, and the webhook is reliable for the completed case.

import { json } from "../_lib/voucherCore.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref");

  if (!ref) return json({ error: "Missing ref" }, 400);

  const pendingRaw = await env.VOUCHERS.get(`pending:${ref}`);

  return json({ status: pendingRaw ? "pending" : "completed" });
}
