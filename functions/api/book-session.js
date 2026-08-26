// POST /api/book-session
//
// Backs the "Book a Session" form on the main site (index.html). Replaces
// the old forms/book-a-table.php, which Cloudflare Pages never actually
// ran (no PHP runtime) — that form silently did nothing on submit.
//
// The frontend uses the existing generic assets/vendor/php-email-form
// validate.js handler unchanged: it POSTs the form as multipart FormData
// to whatever `action` the <form> has, and expects the response body to be
// the literal text "OK" on success, or a human-readable error string
// otherwise — always with HTTP 200, since validate.js only reads the body
// when response.ok is true. Non-2xx responses are reserved here for truly
// unexpected failures, where validate.js falls back to a generic
// "<status> <statusText> <url>" message.
//
// Requires (Cloudflare Pages > Settings > Environment variables):
//   RESEND_API_KEY        — already required for voucher emails
//   BOOKING_NOTIFY_EMAIL  — the inbox that booking requests should land in
//   TURNSTILE_SECRET_KEY  — bot check; see functions/_lib/turnstile.js
//                           (optional in the sense that it degrades rather
//                           than blocks if unset — see that file)

import { escapeHtml } from "../_lib/voucherCore.js";
import { recordBooking, markNotifyEmailState, markConfirmationEmailState } from "../_lib/bookingLedger.js";
import { verifyTurnstile } from "../_lib/turnstile.js";

function ok(message = "OK") {
  return new Response(message, { status: 200, headers: { "Content-Type": "text/plain" } });
}

function generateBookingRef() {
  return "RSB" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

// Same deterrent pattern as initiate-payment.js, isolated under its own KV
// key prefix so booking spam and voucher-purchase abuse don't share a
// counter. Fails OPEN (treated as "not limited") if VOUCHERS is missing or
// misbehaving — a broken rate limiter shouldn't take the whole endpoint
// down with it.
async function isRateLimited(env, ip) {
  try {
    const key = `ratelimit:booking:${ip}`;
    const current = await env.VOUCHERS.get(key);
    const count = current ? parseInt(current, 10) : 0;
    if (count >= 8) return true;
    await env.VOUCHERS.put(key, String(count + 1), { expirationTtl: 600 });
    return false;
  } catch (err) {
    console.error("isRateLimited failed, allowing request through", String(err));
    return false;
  }
}

// Wraps every bookingLedger.js call so a D1 problem (missing binding,
// migration not yet applied, whatever) can never surface as an uncaught
// 500 — it's recorded to the console and the booking/email flow continues.
// This is the fix for a real production bug: recordBooking() alone used to
// be wrapped like this, but the mark*State() calls right after weren't, so
// a D1 failure on THOSE calls (e.g. bookings table not migrated yet) threw
// uncaught after the notify email had already sent — the customer's
// request went through but they saw a raw 500.
async function safeLedgerCall(fn, label, ref) {
  try {
    await fn();
  } catch (err) {
    console.error(`${label} failed`, ref, String(err));
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (await isRateLimited(env, ip)) {
    return ok("Too many booking requests from this connection. Please wait a few minutes and try again, or WhatsApp us directly.");
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return ok("Could not read the form submission. Please try again.");
  }

  // Honeypot: a real user never sees or fills assets/css/main.css's
  // .hp-field. Anything in it is a bot filling every field it finds.
  // Pretend success rather than showing an error — no feedback loop for
  // whatever's scripting this.
  if ((form.get("website") || "").toString().trim() !== "") {
    console.error("book-session: honeypot triggered, dropping silently", ip);
    return ok("OK");
  }

  const turnstileToken = (form.get("cf-turnstile-response") || "").toString();
  const turnstileResult = await verifyTurnstile(env, turnstileToken, ip);
  if (!turnstileResult.ok) {
    if (turnstileResult.reason === "missing-token") {
      // No token at all → essentially always a direct scripted POST that
      // never loaded the page/widget, not a real user. Same silent
      // treatment as the honeypot, for the same reason.
      console.error("book-session: no Turnstile token present, dropping silently", ip);
      return ok("OK");
    }
    // Token was present but Cloudflare rejected it (expired, already used,
    // network hiccup verifying) — this CAN happen to a real user, so give
    // them an actual path to recover instead of a fake success.
    return ok("Verification check failed or expired — please refresh the page and try again.");
  }

  const name = (form.get("name") || "").toString().trim();
  const email = (form.get("email") || "").toString().trim();
  const phone = (form.get("phone") || "").toString().trim();
  const service = (form.get("service") || "").toString().trim();
  const date = (form.get("date") || "").toString().trim();
  const time = (form.get("time") || "").toString().trim();
  const message = (form.get("message") || "").toString().trim();

  if (!name || !email || !phone || !date || !time) {
    return ok("Please fill in your name, email, phone, date and time.");
  }
  if (!isValidEmail(email)) {
    return ok("That email address doesn't look right — please check it and try again.");
  }

  const ref = generateBookingRef();

  try {
    await recordBooking(env, ref, { name, email, phone, service, date, time, message });
  } catch (err) {
    // A D1 failure shouldn't block the booking itself — the notify email
    // below is still the primary channel. Fall through.
    console.error("recordBooking failed", ref, String(err));
  }

  if (!env.RESEND_API_KEY || !env.BOOKING_NOTIFY_EMAIL) {
    // This is almost certainly what's happening in production right now —
    // logging it explicitly and by name instead of letting it fail as a
    // generic Resend error further down, so it shows up unmistakably in
    // `wrangler pages deployment tail` / the dashboard Logs tab.
    console.error(
      "book-session misconfigured:",
      !env.RESEND_API_KEY ? "RESEND_API_KEY is not set. " : "",
      !env.BOOKING_NOTIFY_EMAIL ? "BOOKING_NOTIFY_EMAIL is not set." : ""
    );
    return ok("Your request couldn't be sent right now — please WhatsApp us instead so we don't miss you: +254 703 274 416.");
  }

  const notifyHtml = `
    <div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#16241C;">
      <h2 style="color:#B9924A;">New session booking request</h2>
      <p><b>Ref:</b> ${ref}</p>
      <p><b>Name:</b> ${escapeHtml(name)}<br>
         <b>Email:</b> ${escapeHtml(email)}<br>
         <b>Phone:</b> ${escapeHtml(phone)}</p>
      <p><b>Preferred service:</b> ${escapeHtml(service || "No preference given")}<br>
         <b>Preferred date:</b> ${escapeHtml(date)}<br>
         <b>Preferred time:</b> ${escapeHtml(time)}</p>
      ${message ? `<p><b>Message:</b><br>${escapeHtml(message)}</p>` : ""}
    </div>`;

  let notifyRes;
  try {
    notifyRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Rica Spa Bookings <bookings@ricaspa.beauty>",
        to: [env.BOOKING_NOTIFY_EMAIL],
        reply_to: email,
        subject: `New booking request — ${name} (${date} ${time})`,
        html: notifyHtml,
      }),
    });
  } catch (err) {
    console.error("Resend fetch threw (network/DNS/etc)", ref, String(err));
    await safeLedgerCall(() => markNotifyEmailState(env, ref, "failed"), "markNotifyEmailState", ref);
    return ok("Your request couldn't be sent right now — please WhatsApp us instead so we don't miss you: +254 703 274 416.");
  }

  if (!notifyRes.ok) {
    const errBody = await notifyRes.text().catch(() => "<could not read response body>");
    console.error("Resend rejected the notify email", ref, notifyRes.status, errBody);
    await safeLedgerCall(() => markNotifyEmailState(env, ref, "failed"), "markNotifyEmailState", ref);
    return ok("Your request couldn't be sent right now — please WhatsApp us instead so we don't miss you: +254 703 274 416.");
  }
  await safeLedgerCall(() => markNotifyEmailState(env, ref, "sent"), "markNotifyEmailState", ref);

  // Customer confirmation email — best-effort, doesn't block the "OK"
  // response since the notify email (the part that actually matters to the
  // business) already succeeded.
  try {
    const confirmRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Rica Spa <bookings@ricaspa.beauty>",
        to: [email],
        subject: "We've got your booking request — Rica Spa",
        html: `
          <div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#16241C;">
            <h2 style="color:#B9924A;">Thanks, ${escapeHtml(name)}!</h2>
            <p>We've received your request for
              ${escapeHtml(service || "a session")} on ${escapeHtml(date)} at ${escapeHtml(time)}.
              We'll call or WhatsApp you at ${escapeHtml(phone)} shortly to confirm.</p>
            <p>Need to reach us sooner? WhatsApp +254 703 274 416.</p>
          </div>`,
      }),
    });
    await safeLedgerCall(
      () => markConfirmationEmailState(env, ref, confirmRes.ok ? "sent" : "failed"),
      "markConfirmationEmailState",
      ref
    );
  } catch {
    await safeLedgerCall(() => markConfirmationEmailState(env, ref, "failed"), "markConfirmationEmailState", ref);
  }

  return ok("OK");
}
