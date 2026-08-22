// POST /api/contact-message
//
// Backs the "Get in Touch" form on the main site. Replaces two prior dead
// ends in sequence:
//   1. forms/contact.php — real PHP, but Cloudflare Pages doesn't run PHP,
//      so it silently 404'd, and it pointed at a literal contact@example.com
//      placeholder anyway.
//   2. Web3Forms (assets/js/forms-handler.js, MinimalFormHandler) — worked,
//      but added a third-party dependency and a hardcoded public access key
//      in client-side JS, inconsistent with how every other form on this
//      site is handled (Cloudflare Function + Resend + D1).
//
// Uses the same "always 200, body is 'OK' or an error string" contract as
// book-session.js, matching what assets/vendor/php-email-form/validate.js
// expects — no frontend JS changes needed beyond fixing the form's `action`.
//
// Requires (Cloudflare Pages > Settings > Environment variables):
//   RESEND_API_KEY
//   CONTACT_NOTIFY_EMAIL — the inbox contact messages should land in

import { escapeHtml } from "../_lib/voucherCore.js";
import { recordContactMessage, markContactNotifyState } from "../_lib/contactLedger.js";

function ok(message = "OK") {
  return new Response(message, { status: 200, headers: { "Content-Type": "text/plain" } });
}

function generateContactRef() {
  return "RSC" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

async function isRateLimited(env, ip) {
  const key = `ratelimit:contact:${ip}`;
  const current = await env.VOUCHERS.get(key);
  const count = current ? parseInt(current, 10) : 0;
  if (count >= 8) return true;
  await env.VOUCHERS.put(key, String(count + 1), { expirationTtl: 600 });
  return false;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (await isRateLimited(env, ip)) {
    return ok("Too many messages from this connection. Please wait a few minutes and try again, or WhatsApp us directly.");
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return ok("Could not read the form submission. Please try again.");
  }

  const name = (form.get("name") || "").toString().trim();
  const email = (form.get("email") || "").toString().trim();
  const subject = (form.get("subject") || "").toString().trim();
  const message = (form.get("message") || "").toString().trim();

  if (!name || !email || !message) {
    return ok("Please fill in your name, email and message.");
  }
  if (!isValidEmail(email)) {
    return ok("That email address doesn't look right — please check it and try again.");
  }

  const ref = generateContactRef();

  try {
    await recordContactMessage(env, ref, { name, email, subject, message });
  } catch (err) {
    console.error("recordContactMessage failed", ref, String(err));
  }

  const html = `
    <div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#16241C;">
      <h2 style="color:#B9924A;">New contact message</h2>
      <p><b>Ref:</b> ${ref}</p>
      <p><b>Name:</b> ${escapeHtml(name)}<br>
         <b>Email:</b> ${escapeHtml(email)}</p>
      ${subject ? `<p><b>Subject:</b> ${escapeHtml(subject)}</p>` : ""}
      <p><b>Message:</b><br>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
    </div>`;

  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Rica Spa Website <contact@ricaspa.beauty>",
        to: [env.CONTACT_NOTIFY_EMAIL],
        reply_to: email,
        subject: subject ? `Contact form: ${subject}` : `Contact form message from ${name}`,
        html,
      }),
    });
  } catch {
    await markContactNotifyState(env, ref, "failed");
    return ok("Your message couldn't be sent right now — please WhatsApp us instead: +254 703 274 416.");
  }

  if (!res.ok) {
    await markContactNotifyState(env, ref, "failed");
    return ok("Your message couldn't be sent right now — please WhatsApp us instead: +254 703 274 416.");
  }
  await markContactNotifyState(env, ref, "sent");

  return ok("OK");
}
