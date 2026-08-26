// Server-side verification for Cloudflare Turnstile (the "cf-turnstile"
// widget rendered in index.html's booking/contact forms). The widget
// itself just proves a real browser solved a challenge; this is what
// actually checks that proof against Cloudflare before we trust it.
//
// Requires (Cloudflare Pages > Settings > Environment variables):
//   TURNSTILE_SECRET_KEY — from the Cloudflare dashboard, Turnstile product
//                           (create a widget there, it gives you a site key
//                           for the HTML and a secret key for here)
//
// Also requires swapping the placeholder `data-sitekey="YOUR_TURNSTILE_SITE_KEY"`
// in index.html (both forms) for the real site key — site keys are public
// by design (they're in the page source for every visitor), only the
// secret key is sensitive.

export async function verifyTurnstile(env, token, remoteip) {
  if (!env.TURNSTILE_SECRET_KEY) {
    // Degrade, don't block: if the secret isn't configured yet, log it
    // loudly (so it doesn't repeat the BOOKING_NOTIFY_EMAIL situation —
    // silently broken with nothing in the logs) but let the request
    // through rather than rejecting every booking until someone notices.
    // Honeypot + rate limiting still apply either way.
    console.error("TURNSTILE_SECRET_KEY not set — skipping bot check, relying on honeypot + rate limit only");
    return { ok: true, skipped: true };
  }

  if (!token) {
    // No token at all almost always means the request never went through
    // a real browser page load (direct POST via curl/script) rather than
    // a real user whose widget failed — real users get a token from the
    // widget within a second or two of the page loading.
    return { ok: false, reason: "missing-token" };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", env.TURNSTILE_SECRET_KEY);
    body.set("response", token);
    if (remoteip) body.set("remoteip", remoteip);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json();
    if (!data.success) {
      console.error("Turnstile rejected token", JSON.stringify(data["error-codes"] || []));
    }
    return { ok: !!data.success, reason: data.success ? null : "verification-failed", errorCodes: data["error-codes"] };
  } catch (err) {
    console.error("Turnstile verification request threw", String(err));
    // Network hiccup talking to Cloudflare's own verify endpoint — treat as
    // a soft failure (visible retry message) rather than either silently
    // succeeding (defeats the point) or silently dropping a real booking.
    return { ok: false, reason: "verify-request-failed" };
  }
}
