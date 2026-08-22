// POST /api/redeem-voucher
//
// Lets reception look up a voucher code and mark it redeemed, without
// digging through the Cloudflare KV dashboard manually.
//
// Body: { code: "RICA-XXXX-XXXX", action: "lookup" | "redeem" }
// Header: X-Staff-Secret must match STAFF_SECRET env var
//
// "lookup" just returns the voucher's details and status.
// "redeem" marks it redeemed (once) and returns the same details. Trying to
// redeem an already-redeemed code returns an error instead of silently
// succeeding again.
//
// Requires (Cloudflare Pages > Settings > Environment variables):
//   STAFF_SECRET — any string you choose, share only with staff who need it

import { json, verifyVoucherSignature } from "../_lib/voucherCore.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const providedSecret = request.headers.get("X-Staff-Secret");
  if (!env.STAFF_SECRET || providedSecret !== env.STAFF_SECRET) {
    return json({ error: "Not authorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const code = (body.code || "").trim().toUpperCase();
  const action = body.action === "redeem" ? "redeem" : "lookup";
  const signature = body.signature ? String(body.signature).trim() : null;

  if (!code) return json({ error: "Missing code" }, 400);

  // Only checked when a signature was actually supplied (i.e. the code came
  // from scanning a QR, not typed in by hand). `null` from
  // verifyVoucherSignature means signing isn't configured on this
  // deployment — degrade to code-only lookup rather than blocking staff.
  if (signature) {
    const valid = await verifyVoucherSignature(env, code, signature);
    if (valid === false) {
      return json({ error: "QR signature invalid — this code may have been altered or fabricated" }, 400);
    }
  }

  const raw = await env.VOUCHERS.get(code);
  if (!raw) {
    return json({ error: "Voucher code not found" }, 404);
  }

  const record = JSON.parse(raw);

  if (action === "lookup") {
    return json({ voucher: record });
  }

  // action === "redeem"
  if (record.status === "redeemed") {
    return json(
      { error: "Already redeemed", voucher: record },
      409
    );
  }

  const expiresAt = new Date(record.expiresAt);
  if (expiresAt < new Date()) {
    return json({ error: "Voucher has expired", voucher: record }, 410);
  }

  record.status = "redeemed";
  record.redeemedAt = new Date().toISOString();
  await env.VOUCHERS.put(code, JSON.stringify(record));

  return json({ voucher: record });
}
