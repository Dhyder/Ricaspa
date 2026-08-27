// Session-cookie auth for /dashboard. Reuses STAFF_SECRET (same passphrase
// staff already use for the vouchers/bookings desks) instead of adding a
// second secret to manage. The dashboard is an SPA with no backend of its
// own, so it can't hold STAFF_SECRET client-side — instead, logging in here
// exchanges the passphrase for a short-lived signed cookie. Every dashboard
// API route in functions/api/dashboard-*.js verifies that cookie
// server-side; STAFF_SECRET itself never reaches the browser.

const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8h — staff re-auths once per shift
const COOKIE_NAME = "rica_dash_session";

let cachedKey = null;
let cachedKeySecret = null;

async function getKey(env) {
  const secret = env.STAFF_SECRET;
  if (!secret) return null;
  if (cachedKey && cachedKeySecret === secret) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  cachedKeySecret = secret;
  return cachedKey;
}

async function sign(env, payload) {
  const key = await getKey(env);
  if (!key) return null;
  const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sigBytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Creates the Set-Cookie header value for a fresh session.
export async function createSessionCookie(env) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${expires}`;
  const sig = await sign(env, payload);
  if (!sig) return null;
  const token = `${payload}.${sig}`;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function readCookie(request) {
  const header = request.headers.get("Cookie") || "";
  const match = header.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  return match.slice(COOKIE_NAME.length + 1);
}

// Returns true if the request carries a valid, unexpired session cookie.
export async function isAuthenticated(context) {
  const { request, env } = context;
  const token = readCookie(request);
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = await sign(env, payload);
  if (!expected || expected !== sig) return false;
  const expires = Number(payload);
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  return true;
}
