// Mock/local webhook lifecycle test for the D1-backed payment finalization
// state machine.
//
// This imports the REAL production files unmodified:
//   functions/api/initiate-payment.js
//   functions/api/payment-webhook.js
//   functions/api/order-status.js
//   functions/_lib/voucherCore.js
//   functions/_lib/ledger.js
//
// ...and drives them against mocked KV, a real-schema in-memory D1 (SQLite),
// and a controllable Resend mock. No network calls, no Cloudflare, no
// IntaSend, no real money. This is the AI_HANDOFF.md "local/mock webhook
// lifecycle test" step that gates deployment + the final live KES 500+
// verification.
//
// Run: node test/webhook-lifecycle.test.mjs

import { onRequestPost as initiatePayment } from "../functions/api/initiate-payment.js";
import { onRequestPost as paymentWebhook } from "../functions/api/payment-webhook.js";
import { onRequestGet as orderStatus } from "../functions/api/order-status.js";
import { onRequestPost as redeemVoucher } from "../functions/api/redeem-voucher.js";
import { signVoucherCode } from "../functions/_lib/voucherCore.js";

import { createMockKV } from "./mocks/kv.mjs";
import { createMockD1 } from "./mocks/d1.mjs";
import { installMockResend } from "./mocks/resend.mjs";

const CHALLENGE = "test-challenge-value";

let pass = 0;
let fail = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
  } else {
    fail++;
    failures.push(msg);
    console.log(`  \x1b[31m✗ FAIL\x1b[0m ${msg}`);
  }
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

const SIGNING_SECRET = "test-signing-secret-do-not-use-in-prod";

function makeEnv() {
  return {
    VOUCHERS: createMockKV(),
    DB: createMockD1(),
    INTASEND_WEBHOOK_CHALLENGE: CHALLENGE,
    INTASEND_PUBLISHABLE_KEY: "pub_test_mock",
    RESEND_API_KEY: "resend_test_mock",
    VOUCHER_SIGNING_SECRET: SIGNING_SECRET,
    STAFF_SECRET: "test-staff-secret",
  };
}

function postJSON(url, body, headers = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function getReq(url) {
  return new Request(url, { method: "GET" });
}

async function readJSON(response) {
  return JSON.parse(await response.text());
}

// ---------------------------------------------------------------------
// Scenario 1: happy path, self-purchase (no gifting)
// ---------------------------------------------------------------------
async function scenarioHappyPathSelf(env, resend) {
  section("1. Happy path — self-purchase, single COMPLETE webhook");
  resend.setMode("success");

  const initRes = await initiatePayment({
    request: postJSON("https://ricaspa.beauty/api/initiate-payment", {
      type: "amount",
      value: "1000",
      buyerName: "Jane Wanjiru",
      buyerEmail: "jane@example.com",
      buyerPhone: "254712345678",
    }, { "cf-connecting-ip": "10.0.0.1" }),
    env,
  });
  const init = await readJSON(initRes);
  assert(initRes.status === 200 && init.success, "initiate-payment succeeds and returns a ref");
  assert(await env.VOUCHERS.get(`pending:${init.ref}`), "pending:<ref> written to KV");

  const orderRow = await env.DB.prepare("SELECT * FROM orders WHERE ref = ?").bind(init.ref).first();
  assert(orderRow && orderRow.payment_state === "pending", "D1 order row recorded with payment_state=pending");

  const preStatus = await readJSON(await orderStatus({ request: getReq(`https://ricaspa.beauty/api/order-status?ref=${init.ref}`), env }));
  assert(preStatus.status === "pending", "order-status is 'pending' before webhook fires");

  const webhookRes = await paymentWebhook({
    request: postJSON("https://ricaspa.beauty/api/payment-webhook", {
      challenge: CHALLENGE,
      state: "COMPLETE",
      api_ref: init.ref,
    }),
    env,
  });
  assert(webhookRes.status === 200, "webhook returns 200 on first COMPLETE event");

  const postStatus = await readJSON(await orderStatus({ request: getReq(`https://ricaspa.beauty/api/order-status?ref=${init.ref}`), env }));
  assert(postStatus.status === "completed" && postStatus.code, "order-status is 'completed' with a voucher code after webhook");
  assert(!postStatus.emailWarning, "no email warning on clean self-purchase path");

  const finalRow = await env.DB.prepare("SELECT * FROM orders WHERE ref = ?").bind(init.ref).first();
  assert(finalRow.finalization_state === "completed" && finalRow.voucher_state === "issued", "D1 row shows finalization completed + voucher issued");
  assert(finalRow.email_state === "sent", "D1 row shows email_state=sent");
  assert(!(await env.VOUCHERS.get(`pending:${init.ref}`)), "pending:<ref> removed from KV after finalization");
  assert(await env.VOUCHERS.get(`completed:${init.ref}`), "completed:<ref> written to KV");
  assert(resend.calls.length === 1, "exactly one email sent (buyer only, not a gift)");

  return init.ref;
}

// ---------------------------------------------------------------------
// Scenario 2: gift purchase — recipient + buyer confirmation email
// ---------------------------------------------------------------------
async function scenarioGiftPurchase(env, resend) {
  section("2. Gift purchase — recipient voucher email + buyer confirmation email");
  resend.setMode("success");
  const before = resend.calls.length;

  const initRes = await initiatePayment({
    request: postJSON("https://ricaspa.beauty/api/initiate-payment", {
      type: "service",
      value: "Hot Stone Massage (90 Minutes)",
      buyerName: "Peter Otieno",
      buyerEmail: "peter@example.com",
      giftingOthers: true,
      toName: "Amina",
      recipientEmail: "amina@example.com",
      fromName: "Peter",
      message: "Congrats on the new job!",
    }, { "cf-connecting-ip": "10.0.0.2" }),
    env,
  });
  const init = await readJSON(initRes);
  assert(initRes.status === 200 && init.success, "initiate-payment accepts a gift order");

  const webhookRes = await paymentWebhook({
    request: postJSON("https://ricaspa.beauty/api/payment-webhook", {
      challenge: CHALLENGE, state: "COMPLETE", api_ref: init.ref,
    }),
    env,
  });
  assert(webhookRes.status === 200, "webhook finalizes the gift order");
  assert(resend.calls.length === before + 2, "two emails sent: recipient voucher + buyer confirmation");
  assert(resend.calls[before].to[0] === "amina@example.com", "voucher email addressed to recipient, not buyer");
  assert(resend.calls[before + 1].to[0] === "peter@example.com", "confirmation email addressed to buyer");
}

// ---------------------------------------------------------------------
// Scenario 3: duplicate COMPLETE webhook must not mint a second voucher
// ---------------------------------------------------------------------
async function scenarioDuplicateWebhook(env, resend, ref) {
  section("3. Idempotency — duplicate COMPLETE webhook for an already-finalized ref");
  const before = resend.calls.length;

  const firstRow = await env.DB.prepare("SELECT voucher_code FROM orders WHERE ref = ?").bind(ref).first();

  const dupRes = await paymentWebhook({
    request: postJSON("https://ricaspa.beauty/api/payment-webhook", {
      challenge: CHALLENGE, state: "COMPLETE", api_ref: ref,
    }),
    env,
  });
  assert(dupRes.status === 200, "duplicate webhook is acknowledged with 200 (not an error)");

  const afterRow = await env.DB.prepare("SELECT voucher_code FROM orders WHERE ref = ?").bind(ref).first();
  assert(afterRow.voucher_code === firstRow.voucher_code, "voucher_code unchanged after duplicate webhook");
  assert(resend.calls.length === before, "no additional email sent on duplicate webhook");

  const voucherRows = await env.DB._raw("SELECT COUNT(*) as n FROM email_events WHERE order_ref = ?", ref);
  assert(voucherRows[0].n === 1, "exactly one email_events row exists for this ref (one voucher email, no gift confirmation)");
}

// ---------------------------------------------------------------------
// Scenario 4: FAILED / CANCELED IntaSend states
// ---------------------------------------------------------------------
async function scenarioFailedPayment(env) {
  section("4. FAILED payment state from IntaSend");

  const initRes = await initiatePayment({
    request: postJSON("https://ricaspa.beauty/api/initiate-payment", {
      type: "amount", value: "500", buyerName: "Sam Kip", buyerEmail: "sam@example.com",
    }, { "cf-connecting-ip": "10.0.0.3" }),
    env,
  });
  const init = await readJSON(initRes);

  const webhookRes = await paymentWebhook({
    request: postJSON("https://ricaspa.beauty/api/payment-webhook", {
      challenge: CHALLENGE, state: "FAILED", api_ref: init.ref,
    }),
    env,
  });
  assert(webhookRes.status === 200, "FAILED webhook acknowledged");

  const status = await readJSON(await orderStatus({ request: getReq(`https://ricaspa.beauty/api/order-status?ref=${init.ref}`), env }));
  assert(status.status === "failed", "order-status reports 'failed'");
  assert(!(await env.VOUCHERS.get(`pending:${init.ref}`)), "pending:<ref> cleared on FAILED");
  assert(await env.VOUCHERS.get(`failed:${init.ref}`), "failed:<ref> written to KV");
}

// ---------------------------------------------------------------------
// Scenario 5: invalid challenge must be rejected without side effects
// ---------------------------------------------------------------------
async function scenarioBadChallenge(env) {
  section("5. Security — wrong webhook challenge is rejected");

  const initRes = await initiatePayment({
    request: postJSON("https://ricaspa.beauty/api/initiate-payment", {
      type: "amount", value: "500", buyerName: "Test", buyerEmail: "t@example.com",
    }, { "cf-connecting-ip": "10.0.0.4" }),
    env,
  });
  const init = await readJSON(initRes);

  const badRes = await paymentWebhook({
    request: postJSON("https://ricaspa.beauty/api/payment-webhook", {
      challenge: "wrong-value", state: "COMPLETE", api_ref: init.ref,
    }),
    env,
  });
  assert(badRes.status === 401, "webhook rejects an incorrect challenge with 401");

  const row = await env.DB.prepare("SELECT * FROM orders WHERE ref = ?").bind(init.ref).first();
  assert(row.finalization_state === "pending", "order untouched in D1 after rejected webhook");
  assert(await env.VOUCHERS.get(`pending:${init.ref}`), "pending:<ref> still present after rejected webhook");
}

// ---------------------------------------------------------------------
// Scenario 6: finalization failure (Resend down) then a successful retry —
// must reuse the SAME voucher code, not mint a second one.
// ---------------------------------------------------------------------
async function scenarioFinalizationRetry(env, resend) {
  section("6. Resilience — email provider down during finalization, then retried");

  const initRes = await initiatePayment({
    request: postJSON("https://ricaspa.beauty/api/initiate-payment", {
      type: "amount", value: "2500", buyerName: "Grace M", buyerEmail: "grace@example.com",
    }, { "cf-connecting-ip": "10.0.0.5" }),
    env,
  });
  const init = await readJSON(initRes);

  resend.setMode("fail");
  const firstAttempt = await paymentWebhook({
    request: postJSON("https://ricaspa.beauty/api/payment-webhook", {
      challenge: CHALLENGE, state: "COMPLETE", api_ref: init.ref,
    }),
    env,
  });
  assert(firstAttempt.status === 500, "webhook returns 500 when Resend is down during finalization");

  const midRow = await env.DB.prepare("SELECT * FROM orders WHERE ref = ?").bind(init.ref).first();
  assert(midRow.payment_state === "completed", "payment_state stays 'completed' (customer DID pay) despite email failure");
  assert(midRow.finalization_state === "pending", "finalization_state reverted to 'pending' so a retry can resume");
  // Note: the D1 `voucher_code` column is only written by markFinalizationSuccess,
  // i.e. on a fully successful pass. It stays null here by design. The real
  // duplicate-mint guard during a failed-finalization retry is the KV
  // `voucher-ref:<ref>` anchor written inside finalizeVoucher() *before* the
  // email send is attempted — that's what we check next.
  const anchorCode = await env.VOUCHERS.get(`voucher-ref:${init.ref}`);
  assert(anchorCode, "KV voucher-ref:<ref> idempotency anchor was written before the email failure");
  assert(await env.VOUCHERS.get(anchorCode), "the voucher record itself was persisted in KV despite the email failure");

  const midStatus = await readJSON(await orderStatus({ request: getReq(`https://ricaspa.beauty/api/order-status?ref=${init.ref}`), env }));
  assert(midStatus.status === "pending" && midStatus.paymentConfirmed === true, "order-status shows payment-confirmed-but-still-finalizing, not a false 'completed'");

  const codeBeforeRetry = anchorCode;
  resend.setMode("success");
  const retryAttempt = await paymentWebhook({
    request: postJSON("https://ricaspa.beauty/api/payment-webhook", {
      challenge: CHALLENGE, state: "COMPLETE", api_ref: init.ref,
    }),
    env,
  });
  assert(retryAttempt.status === 200, "retried webhook succeeds once Resend recovers");

  const finalRow = await env.DB.prepare("SELECT * FROM orders WHERE ref = ?").bind(init.ref).first();
  assert(finalRow.finalization_state === "completed", "finalization completes on retry");
  assert(finalRow.voucher_code === codeBeforeRetry, "retry reused the SAME voucher code — no duplicate voucher minted");

  const codeCount = await env.DB._raw(
    "SELECT COUNT(*) as n FROM email_events WHERE order_ref = ? AND status = 'sent'",
    init.ref
  );
  assert(codeCount[0].n === 1, "exactly one successful email_events row despite the failed+retried attempt");
}

// ---------------------------------------------------------------------
// Scenario 7: unknown / malformed requests
// ---------------------------------------------------------------------
async function scenarioMalformed(env) {
  section("7. Input handling — missing ref, unknown ref, bad JSON");

  const missingRef = await paymentWebhook({
    request: postJSON("https://ricaspa.beauty/api/payment-webhook", { challenge: CHALLENGE, state: "COMPLETE" }),
    env,
  });
  assert(missingRef.status === 400, "webhook rejects a COMPLETE event with no api_ref");

  const unknownStatus = await readJSON(await orderStatus({ request: getReq("https://ricaspa.beauty/api/order-status?ref=RS-DOES-NOT-EXIST"), env }));
  assert(unknownStatus.status === "unknown", "order-status reports 'unknown' for a ref that was never created");

  const badBody = await paymentWebhook({
    request: new Request("https://ricaspa.beauty/api/payment-webhook", { method: "POST", body: "{not json" }),
    env,
  });
  assert(badBody.status === 400, "webhook rejects unparsable JSON body");
}

// ---------------------------------------------------------------------
// Scenario 8: rate limiting on initiate-payment
// ---------------------------------------------------------------------
async function scenarioRateLimit(env) {
  section("8. Abuse deterrent — initiate-payment rate limiting (8/10min/IP)");
  const ip = "10.0.0.99";
  let lastStatus;
  for (let i = 0; i < 9; i++) {
    const res = await initiatePayment({
      request: postJSON("https://ricaspa.beauty/api/initiate-payment", {
        type: "amount", value: "500", buyerName: "Spam", buyerEmail: "spam@example.com",
      }, { "cf-connecting-ip": ip }),
      env,
    });
    lastStatus = res.status;
  }
  assert(lastStatus === 429, "9th request from the same IP within 10 minutes is rate-limited (429)");
}

// ---------------------------------------------------------------------
// Scenario 9: signed QR verification at the staff redemption endpoint
// ---------------------------------------------------------------------
function staffPost(body) {
  return new Request("https://ricaspa.beauty/api/redeem-voucher", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Staff-Secret": "test-staff-secret" },
    body: JSON.stringify(body),
  });
}

async function scenarioQrSignature(env, ref) {
  section("9. Signed QR — tamper detection at the staff redemption endpoint");

  const code = await env.VOUCHERS.get(`voucher-ref:${ref}`);
  const correctSig = await signVoucherCode(env, code);
  assert(correctSig && correctSig.length === 10, "signVoucherCode produces a 10-char signature");

  const goodLookup = await redeemVoucher({ request: staffPost({ code, action: "lookup", signature: correctSig }), env });
  assert(goodLookup.status === 200, "lookup succeeds when the QR signature matches");

  const badLookup = await redeemVoucher({ request: staffPost({ code, action: "lookup", signature: "0000000000" }), env });
  assert(badLookup.status === 400, "lookup rejects a fabricated/mismatched signature");
  const badBody = await readJSON(badLookup);
  assert(/signature/i.test(badBody.error || ""), "rejection explains it's a signature problem");

  const manualLookup = await redeemVoucher({ request: staffPost({ code, action: "lookup" }), env });
  assert(manualLookup.status === 200, "manual code entry (no signature, e.g. typed by hand) still works — backward compatible");

  const noSecretEnv = { ...env, VOUCHER_SIGNING_SECRET: undefined };
  const degradedLookup = await redeemVoucher({ request: staffPost({ code, action: "lookup", signature: correctSig }), env: noSecretEnv });
  assert(degradedLookup.status === 200, "if VOUCHER_SIGNING_SECRET isn't configured, verification degrades to code-only instead of blocking staff");

  const wrongCode = code.replace(/.$/, code.endsWith("9") ? "8" : "9");
  const forgedLookup = await redeemVoucher({ request: staffPost({ code: wrongCode, action: "lookup", signature: correctSig }), env });
  assert(forgedLookup.status === 400 || forgedLookup.status === 404, "a signature copied onto a different/edited code is rejected, not silently accepted");

  const redeemRes = await redeemVoucher({ request: staffPost({ code, action: "redeem", signature: correctSig }), env });
  assert(redeemRes.status === 200, "signed redeem succeeds");
  const redeemAgain = await redeemVoucher({ request: staffPost({ code, action: "redeem", signature: correctSig }), env });
  assert(redeemAgain.status === 409, "redeeming an already-redeemed voucher is rejected, signature notwithstanding");
}

// ---------------------------------------------------------------------
async function main() {
  console.log("Rica Spa — mock/local webhook lifecycle test");
  console.log("(no network calls, no Cloudflare, no IntaSend, no real money)\n");

  const env = makeEnv();
  const resend = installMockResend();

  try {
    const ref = await scenarioHappyPathSelf(env, resend);
    await scenarioGiftPurchase(env, resend);
    await scenarioDuplicateWebhook(env, resend, ref);
    await scenarioFailedPayment(env);
    await scenarioBadChallenge(env);
    await scenarioFinalizationRetry(env, resend);
    await scenarioMalformed(env);
    await scenarioQrSignature(env, ref);
    await scenarioRateLimit(makeEnv()); // fresh env: isolate rate-limit counters
  } finally {
    resend.restore();
    env.DB._close();
  }

  console.log(`\n${"-".repeat(60)}`);
  console.log(`${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log("\nFailed checks:");
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exitCode = 1;
  } else {
    console.log("\nAll checks passed. Safe to proceed to deployment,");
    console.log("then the single controlled KES 500+ live verification.");
  }
}

main().catch((err) => {
  console.error("\nTest runner crashed:", err);
  process.exitCode = 1;
});
