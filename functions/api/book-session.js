// POST /api/book-session
import { escapeHtml } from "../_lib/voucherCore.js";
import { recordBooking, markNotifyEmailState, markConfirmationEmailState } from "../_lib/bookingLedger.js";
import { verifyTurnstile } from "../_lib/turnstile.js";
import { sendTikTokEvent } from "../_lib/tiktokEvents.js";

function ok(message = "OK") { return new Response(message, { status: 200, headers: { "Content-Type": "text/plain" } }); }
function generateBookingRef() { return "RSB" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(); }
async function isRateLimited(env, ip) { try { const key = `ratelimit:booking:${ip}`; const current = await env.VOUCHERS.get(key); const count = current ? parseInt(current, 10) : 0; if (count >= 8) return true; await env.VOUCHERS.put(key, String(count + 1), { expirationTtl: 600 }); } catch (err) { console.error("isRateLimited failed", String(err)); } return false; }
async function safeLedgerCall(fn, label, ref) { try { await fn(); } catch (err) { console.error(`${label} failed`, ref, String(err)); } }
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

export async function onRequestPost(context) {
  const { request, env } = context;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (await isRateLimited(env, ip)) return ok("Too many booking requests from this connection. Please wait a few minutes and try again, or WhatsApp us directly.");

  let form; try { form = await request.formData(); } catch { return ok("Could not read the form submission. Please try again."); }
  if ((form.get("website") || "").toString().trim() !== "") return ok("OK");

  const turnstileToken = (form.get("cf-turnstile-response") || "").toString();
  const turnstileResult = await verifyTurnstile(env, turnstileToken, ip);
  if (!turnstileResult.ok) {
    if (turnstileResult.reason === "missing-token") return ok("OK");
    return ok("Verification check failed or expired — please refresh the page and try again.");
  }

  const name = (form.get("name") || "").toString().trim();
  const email = (form.get("email") || "").toString().trim();
  const phone = (form.get("phone") || "").toString().trim();
  const service = (form.get("service") || "").toString().trim();
  const date = (form.get("date") || "").toString().trim();
  const time = (form.get("time") || "").toString().trim();
  const message = (form.get("message") || "").toString().trim();
  if (!name || !email || !phone || !date || !time) return ok("Please fill in your name, email, phone, date and time.");
  if (!isValidEmail(email)) return ok("That email address doesn't look right — please check it and try again.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return ok("Date/time format wasn't recognized — please use the date and time pickers and try again.");

  const ref = generateBookingRef();
  try { await recordBooking(env, ref, { name, email, phone, service, date, time, message }); } catch (err) { console.error("recordBooking failed", ref, String(err)); }

  if (!env.RESEND_API_KEY || !env.BOOKING_NOTIFY_EMAIL) {
    console.error("book-session misconfigured", !env.RESEND_API_KEY ? "RESEND_API_KEY missing" : "", !env.BOOKING_NOTIFY_EMAIL ? "BOOKING_NOTIFY_EMAIL missing" : "");
    return ok("Your request couldn't be sent right now — please WhatsApp us instead so we don't miss you: +254 703 274 416.");
  }

  const notifyHtml = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#16241C;"><h2 style="color:#B9924A;">New session booking request</h2><p><b>Ref:</b> ${ref}</p><p><b>Name:</b> ${escapeHtml(name)}<br><b>Email:</b> ${escapeHtml(email)}<br><b>Phone:</b> ${escapeHtml(phone)}</p><p><b>Preferred service:</b> ${escapeHtml(service || "No preference given")}<br><b>Preferred date:</b> ${escapeHtml(date)}<br><b>Preferred time:</b> ${escapeHtml(time)}</p>${message ? `<p><b>Message:</b><br>${escapeHtml(message)}</p>` : ""}</div>`;
  let notifyRes;
  try { notifyRes = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Rica Spa Bookings <bookings@ricaspa.beauty>", to: [env.BOOKING_NOTIFY_EMAIL], reply_to: email, subject: `New booking request — ${name} (${date} ${time})`, html: notifyHtml }) }); }
  catch (err) { console.error("Resend fetch threw", ref, String(err)); await safeLedgerCall(() => markNotifyEmailState(env, ref, "failed"), "markNotifyEmailState", ref); return ok("Your request couldn't be sent right now — please WhatsApp us instead so we don't miss you: +254 703 274 416."); }
  if (!notifyRes.ok) { console.error("Resend rejected notify", ref, notifyRes.status, await notifyRes.text().catch(() => "")); await safeLedgerCall(() => markNotifyEmailState(env, ref, "failed"), "markNotifyEmailState", ref); return ok("Your request couldn't be sent right now — please WhatsApp us instead so we don't miss you: +254 703 274 416."); }
  await safeLedgerCall(() => markNotifyEmailState(env, ref, "sent"), "markNotifyEmailState", ref);

  // Fire Schedule only after the booking request has successfully reached Rica Spa.
  await sendTikTokEvent(env, request, { event: "Schedule", eventId: ref, email, phone, externalId: ref, pageUrl: new URL("/", request.url).toString(), description: service || "Spa session" }).catch(err => console.error("TikTok Schedule failed", ref, String(err)));

  try {
    const confirmRes = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Rica Spa <bookings@ricaspa.beauty>", to: [email], subject: "We've got your booking request — Rica Spa", html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#16241C;"><h2 style="color:#B9924A;">Thanks, ${escapeHtml(name)}!</h2><p>We've received your request for ${escapeHtml(service || "a session")} on ${escapeHtml(date)} at ${escapeHtml(time)}. We'll call or WhatsApp you at ${escapeHtml(phone)} shortly to confirm.</p><p>Need to reach us sooner? WhatsApp +254 703 274 416.</p></div>` }) });
    await safeLedgerCall(() => markConfirmationEmailState(env, ref, confirmRes.ok ? "sent" : "failed"), "markConfirmationEmailState", ref);
  } catch { await safeLedgerCall(() => markConfirmationEmailState(env, ref, "failed"), "markConfirmationEmailState", ref); }
  return ok("OK");
}
