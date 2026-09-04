// TikTok Events API helper.
// Configure TIKTOK_PIXEL_ID and TIKTOK_ACCESS_TOKEN in Cloudflare Pages.
// Optional TIKTOK_TEST_EVENT_CODE can be used temporarily with TikTok Events
// Manager > Test Events. Never expose the access token to browser code.

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || "").trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sendTikTokEvent(env, request, {
  event,
  eventId,
  value,
  currency = "KES",
  email,
  phone,
  externalId,
  pageUrl,
  description,
}) {
  if (!env.TIKTOK_PIXEL_ID || !env.TIKTOK_ACCESS_TOKEN) {
    console.warn("TikTok Events API not configured", event);
    return { ok: false, skipped: true };
  }

  const properties = { value: Number(value || 0), currency };
  if (description) properties.description = String(description).slice(0, 500);

  const user = {};
  if (email) user.email = await sha256Hex(email);
  if (phone) user.phone_number = await sha256Hex(phone.replace(/[^\d+]/g, ""));
  if (externalId) user.external_id = await sha256Hex(externalId);

  const url = pageUrl || new URL(request.url).origin;
  const payload = {
    pixel_code: env.TIKTOK_PIXEL_ID,
    event,
    event_id: eventId,
    timestamp: new Date().toISOString(),
    context: {
      page: { url, referrer: request.headers.get("referer") || undefined },
      user_agent: request.headers.get("user-agent") || undefined,
      ip: request.headers.get("cf-connecting-ip") || undefined,
      user,
    },
    properties,
    ...(env.TIKTOK_TEST_EVENT_CODE ? { test_event_code: env.TIKTOK_TEST_EVENT_CODE } : {}),
  };

  const response = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
    method: "POST",
    headers: {
      "Access-Token": env.TIKTOK_ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  if (!response.ok) {
    console.error("TikTok Events API HTTP error", response.status, body);
    return { ok: false, status: response.status, body };
  }

  let parsed;
  try { parsed = JSON.parse(body); } catch { parsed = null; }
  if (parsed && parsed.code !== 0) {
    console.error("TikTok Events API rejected event", parsed);
    return { ok: false, body: parsed };
  }

  return { ok: true, body: parsed };
}
