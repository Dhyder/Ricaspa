// Minimal IntaSend API client.
// Docs: https://developers.intasend.com/
//
// Unlike Pesapal, IntaSend uses ONE gateway URL for both sandbox and live —
// which mode you're in is determined purely by which keys you use (test
// keys vs live keys from the dashboard), not a different base URL.
//
// Requires env vars:
//   INTASEND_PUBLISHABLE_KEY   from dashboard (test or live)
//   INTASEND_SECRET_KEY        from dashboard (test or live)
//   INTASEND_WEBHOOK_CHALLENGE the challenge string you set when configuring
//                               the webhook URL in the IntaSend dashboard

const BASE_URL = "https://api.intasend.com";

export async function createCheckout(env, { ref, amount, description, callbackUrl, billing }) {
  const res = await fetch(`${BASE_URL}/api/v1/checkout/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-IntaSend-Public-API-Key": env.INTASEND_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      amount,
      currency: "KES",
      api_ref: ref,
      redirect_url: callbackUrl,
      email: billing.email,
      phone_number: billing.phone || "",
      first_name: billing.firstName || billing.name || "Guest",
      last_name: billing.lastName || "",
      comment: description,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.url) {
    throw new Error("IntaSend checkout creation failed: " + JSON.stringify(data));
  }
  return data; // { id (checkout_id), url, signature, ... }
}

export async function checkStatus(env, { checkoutId, signature }) {
  const res = await fetch(`${BASE_URL}/api/v1/payment/status/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${env.INTASEND_SECRET_KEY}`,
    },
    body: JSON.stringify({ checkout_id: checkoutId, signature }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error("IntaSend status check failed: " + JSON.stringify(data));
  }
  return data; // { invoice: { state: "PENDING"|"PROCESSING"|"COMPLETE"|"FAILED"|"CANCELED"|"PARTIAL"|"RETRY", ... }, meta: {...} }
}
