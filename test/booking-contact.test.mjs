// Mock/local lifecycle test for /api/book-session and /api/contact-message
// — the two forms that used to be Web3Forms (client-side, third-party) and
// are now Cloudflare Functions matching the rest of the app's pattern
// (Resend + D1, degrade-if-no-DB).
//
// Run: node test/booking-contact.test.mjs

import { onRequestPost as bookSession } from "../functions/api/book-session.js";
import { onRequestPost as contactMessage } from "../functions/api/contact-message.js";
import { onRequestGet as bookingsList } from "../functions/api/bookings-list.js";
import { onRequestPost as updateBookingStatus } from "../functions/api/update-booking-status.js";
import { createMockKV } from "./mocks/kv.mjs";
import { createMockD1 } from "./mocks/d1.mjs";
import { installMockResend } from "./mocks/resend.mjs";

let pass = 0, fail = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
  else { fail++; failures.push(msg); console.log(`  \x1b[31m✗ FAIL\x1b[0m ${msg}`); }
}
function section(title) { console.log(`\n\x1b[1m${title}\x1b[0m`); }

function makeEnv() {
  return {
    VOUCHERS: createMockKV(),
    DB: createMockD1(),
    RESEND_API_KEY: "resend_test_mock",
    BOOKING_NOTIFY_EMAIL: "spa-owner@example.com",
    CONTACT_NOTIFY_EMAIL: "spa-owner@example.com",
  };
}

function formPost(url, fields, headers = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return new Request(url, { method: "POST", body: fd, headers });
}

async function readJSON(response) {
  return JSON.parse(await response.text());
}

async function scenarioBookingHappyPath(env, resend) {
  section("1. Booking — valid submission");
  resend.setMode("success");

  const res = await bookSession({
    request: formPost("https://ricaspa.beauty/api/book-session", {
      name: "Wanjiku Kamau",
      email: "wanjiku@example.com",
      phone: "254712345678",
      service: "Hot Stone Massage (90 Minutes)",
      date: "2026-09-01",
      time: "14:00",
      message: "First time, please advise on best option",
    }, { "cf-connecting-ip": "10.1.0.1" }),
    env,
  });
  assert(res.status === 200, "returns HTTP 200 (contract: always 200, body carries outcome)");
  const body = await res.text();
  assert(body.trim() === "OK", "body is exactly 'OK' on success, matching validate.js's success check");
  assert(resend.calls.length === 2, "two emails sent: spa notification + customer confirmation");
  assert(resend.calls[0].to[0] === "spa-owner@example.com", "notify email addressed to BOOKING_NOTIFY_EMAIL");
  assert(resend.calls[1].to[0] === "wanjiku@example.com", "confirmation email addressed to the customer");

  const rows = await env.DB._raw("SELECT * FROM bookings WHERE email = ?", "wanjiku@example.com");
  assert(rows.length === 1, "booking recorded in D1");
  assert(rows[0].service === "Hot Stone Massage (90 Minutes)", "service field recorded correctly");
  assert(rows[0].notify_email_state === "sent", "D1 row reflects the successful notify email");
}

async function scenarioBookingMissingFields(env) {
  section("2. Booking — missing required fields");
  const res = await bookSession({
    request: formPost("https://ricaspa.beauty/api/book-session", { name: "No Email Guy" }, { "cf-connecting-ip": "10.1.0.2" }),
    env,
  });
  assert(res.status === 200, "still HTTP 200 (validate.js only shows body text on 200 responses)");
  const body = await res.text();
  assert(body.trim() !== "OK", "body is a human-readable error, not 'OK'");
  assert(/fill in/i.test(body), "error explains what's missing");
}

async function scenarioBookingBadEmail(env) {
  section("3. Booking — malformed email");
  const res = await bookSession({
    request: formPost("https://ricaspa.beauty/api/book-session", {
      name: "Test", email: "not-an-email", phone: "254700000000", date: "2026-09-01", time: "10:00",
    }, { "cf-connecting-ip": "10.1.0.3" }),
    env,
  });
  const body = await res.text();
  assert(body.trim() !== "OK", "rejects an invalid email address");
}

async function scenarioBookingResendDown(env, resend) {
  section("4. Booking — Resend outage still gives an actionable message");
  resend.setMode("fail");
  const res = await bookSession({
    request: formPost("https://ricaspa.beauty/api/book-session", {
      name: "Grace", email: "grace@example.com", phone: "254711111111", date: "2026-09-05", time: "11:00",
    }, { "cf-connecting-ip": "10.1.0.4" }),
    env,
  });
  const body = await res.text();
  assert(body.trim() !== "OK", "email failure surfaces as an error, not a false success");
  assert(/whatsapp/i.test(body), "fallback message points the customer to WhatsApp instead of losing the request");

  const rows = await env.DB._raw("SELECT notify_email_state FROM bookings WHERE email = ?", "grace@example.com");
  assert(rows[0].notify_email_state === "failed", "D1 row correctly reflects the failed notify email — booking isn't silently lost, it's flagged");
  resend.setMode("success");
}

async function scenarioBookingRateLimit(env) {
  section("5. Booking — rate limiting (8/10min/IP)");
  const ip = "10.1.0.99";
  let lastBody;
  for (let i = 0; i < 9; i++) {
    const res = await bookSession({
      request: formPost("https://ricaspa.beauty/api/book-session", {
        name: "Spam", email: `spam${i}@example.com`, phone: "254700000000", date: "2026-09-01", time: "10:00",
      }, { "cf-connecting-ip": ip }),
      env,
    });
    lastBody = (await res.text()).trim();
  }
  assert(/too many/i.test(lastBody), "9th request from the same IP within 10 minutes is rate-limited");
}

async function scenarioBookingDegradedNoDB(resend) {
  section("6. Booking — degrades gracefully with no D1 binding");
  resend.setMode("success");
  const noDbEnv = { VOUCHERS: createMockKV(), RESEND_API_KEY: "x", BOOKING_NOTIFY_EMAIL: "owner@example.com" };
  const res = await bookSession({
    request: formPost("https://ricaspa.beauty/api/book-session", {
      name: "No DB", email: "nodb@example.com", phone: "254700000000", date: "2026-09-01", time: "10:00",
    }, { "cf-connecting-ip": "10.1.0.5" }),
    env: noDbEnv,
  });
  const body = await res.text();
  assert(body.trim() === "OK", "booking still succeeds via email even without a DB binding — not blocked by an optional feature");
}

// Regression test for a real production bug: recordBooking() was wrapped
// in try/catch, but the mark*EmailState() calls right after weren't — so a
// D1 write failure on THOSE calls (e.g. migration not yet applied, table
// doesn't exist) threw uncaught AFTER the notify email had already sent,
// surfacing as a raw HTTP 500 to the customer instead of the friendly
// "OK"/error-text contract every other path uses.
async function scenarioBookingBrokenD1Table(resend) {
  section("6b. Regression — D1 table missing must not produce a raw 500");
  resend.setMode("success");
  const brokenDbEnv = {
    VOUCHERS: createMockKV(),
    RESEND_API_KEY: "x",
    BOOKING_NOTIFY_EMAIL: "owner@example.com",
    // A DB binding whose every query throws — simulates "table doesn't
    // exist yet" (unapplied migration) without needing a real broken schema.
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async run() { throw new Error("no such table: bookings"); },
              async first() { throw new Error("no such table: bookings"); },
              async all() { throw new Error("no such table: bookings"); },
            };
          },
        };
      },
    },
  };
  const res = await bookSession({
    request: formPost("https://ricaspa.beauty/api/book-session", {
      name: "Broken DB", email: "brokendb@example.com", phone: "254700000000", date: "2026-09-01", time: "10:00",
    }, { "cf-connecting-ip": "10.1.0.6" }),
    env: brokenDbEnv,
  });
  assert(res.status === 200, "does NOT surface as HTTP 500 even when every D1 call throws");
  const body = await res.text();
  assert(body.trim() === "OK", "the booking + email still succeeds — D1 is a nice-to-have record, not a hard dependency");
}

async function scenarioContactHappyPath(env, resend) {
  section("7. Contact — valid submission");
  resend.setMode("success");
  const before = resend.calls.length;

  const res = await contactMessage({
    request: formPost("https://ricaspa.beauty/api/contact-message", {
      name: "Brian Otieno",
      email: "brian@example.com",
      subject: "Question about gift vouchers",
      message: "Do vouchers expire?",
    }, { "cf-connecting-ip": "10.2.0.1" }),
    env,
  });
  assert(res.status === 200 && (await res.text()).trim() === "OK", "contact message accepted");
  assert(resend.calls.length === before + 1, "notify email sent");
  assert(resend.calls[before].subject.includes("Question about gift vouchers"), "subject line carried through to the email");

  const rows = await env.DB._raw("SELECT * FROM contact_messages WHERE email = ?", "brian@example.com");
  assert(rows.length === 1, "contact message recorded in D1");
}

async function scenarioContactMissingMessage(env) {
  section("8. Contact — missing message body");
  const res = await contactMessage({
    request: formPost("https://ricaspa.beauty/api/contact-message", {
      name: "Test", email: "test@example.com",
    }, { "cf-connecting-ip": "10.2.0.2" }),
    env,
  });
  const body = await res.text();
  assert(body.trim() !== "OK", "rejects a submission with no message");
}

// ---------------------------------------------------------------------
// Scenario 9: slot tracker (staff-only list + status update)
// ---------------------------------------------------------------------
function staffGet(url) {
  return new Request(url, { headers: { "X-Staff-Secret": "test-staff-secret" } });
}
function staffPostJson(url, body) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Staff-Secret": "test-staff-secret" },
    body: JSON.stringify(body),
  });
}

async function scenarioSlotTracker(env, resend) {
  section("9. Slot tracker — list by date, list upcoming, update status");
  resend.setMode("success");
  env.STAFF_SECRET = "test-staff-secret";

  await bookSession({
    request: formPost("https://ricaspa.beauty/api/book-session", {
      name: "Amina Yusuf", email: "amina@example.com", phone: "254722000000",
      service: "Swedish Massage (1 Hour)", date: "2026-09-10", time: "14:00",
    }, { "cf-connecting-ip": "10.3.0.1" }),
    env,
  });
  await bookSession({
    request: formPost("https://ricaspa.beauty/api/book-session", {
      name: "David Mwangi", email: "david@example.com", phone: "254733000000",
      service: "Deep Tissue Massage (1 Hour)", date: "2026-09-10", time: "10:00",
    }, { "cf-connecting-ip": "10.3.0.2" }),
    env,
  });

  const unauthorized = await bookingsList({ request: new Request("https://ricaspa.beauty/api/bookings-list?date=2026-09-10"), env });
  assert(unauthorized.status === 401, "listing requires the staff passphrase");

  const dayRes = await bookingsList({ request: staffGet("https://ricaspa.beauty/api/bookings-list?date=2026-09-10"), env });
  const day = await readJSON(dayRes);
  assert(dayRes.status === 200 && day.bookings.length === 2, "both bookings for the date are returned");
  assert(day.bookings[0].preferred_time === "10:00" && day.bookings[1].preferred_time === "14:00", "sorted by time ascending, not insertion order");
  assert(day.bookings.every((b) => b.status === "new"), "new bookings default to status 'new'");

  const emptyDayRes = await bookingsList({ request: staffGet("https://ricaspa.beauty/api/bookings-list?date=2026-01-01"), env });
  const emptyDay = await readJSON(emptyDayRes);
  assert(emptyDay.bookings.length === 0, "a date with no bookings returns an empty list, not an error");

  const ref = day.bookings[0].ref;
  const confirmRes = await updateBookingStatus({ request: staffPostJson("https://ricaspa.beauty/api/update-booking-status", { ref, status: "confirmed" }), env });
  assert(confirmRes.status === 200, "staff can mark a booking confirmed");

  const afterConfirm = await bookingsList({ request: staffGet("https://ricaspa.beauty/api/bookings-list?date=2026-09-10"), env });
  const afterConfirmBody = await readJSON(afterConfirm);
  assert(afterConfirmBody.bookings.find((b) => b.ref === ref).status === "confirmed", "status change is reflected on the next list call");

  const invalidStatus = await updateBookingStatus({ request: staffPostJson("https://ricaspa.beauty/api/update-booking-status", { ref, status: "definitely-not-a-real-status" }), env });
  assert(invalidStatus.status === 400, "rejects an invalid status value");

  const missingRef = await updateBookingStatus({ request: staffPostJson("https://ricaspa.beauty/api/update-booking-status", { ref: "RSB-DOES-NOT-EXIST", status: "confirmed" }), env });
  assert(missingRef.status === 404, "updating a nonexistent booking ref returns 404, not a silent no-op");

  const upcomingRes = await bookingsList({ request: staffGet("https://ricaspa.beauty/api/bookings-list?upcoming=1"), env });
  const upcoming = await readJSON(upcomingRes);
  assert(upcoming.bookings.length >= 2, "upcoming view includes bookings without needing an exact date match");
}

async function main() {
  console.log("Rica Spa — booking + contact form backend test (no network, no third-party form service)\n");
  const env = makeEnv();
  const resend = installMockResend();
  try {
    await scenarioBookingHappyPath(env, resend);
    await scenarioBookingMissingFields(env);
    await scenarioBookingBadEmail(env);
    await scenarioBookingResendDown(env, resend);
    await scenarioBookingRateLimit(makeEnv());
    await scenarioBookingDegradedNoDB(resend);
    await scenarioBookingBrokenD1Table(resend);
    await scenarioContactHappyPath(env, resend);
    await scenarioContactMissingMessage(env);
    await scenarioSlotTracker(makeEnv(), resend);
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
  }
}

main().catch((err) => {
  console.error("\nTest runner crashed:", err);
  process.exitCode = 1;
});
