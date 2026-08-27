const SESSION_TTL_SECONDS = 60 * 60 * 8;
const COOKIE_NAME = "rica_dash_session";
let cachedKey = null;
let cachedKeySecret = null;

async function getKey(env) {
  const secret = env.STAFF_SECRET;
  if (!secret) return null;
  if (cachedKey && cachedKeySecret === secret) return cachedKey;
  cachedKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  cachedKeySecret = secret;
  return cachedKey;
}

async function sign(env, payload) {
  const key = await getKey(env);
  if (!key) return null;
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(request) {
  const header = request.headers.get("Cookie") || "";
  const match = header.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE_NAME}=`));
  return match ? match.slice(COOKIE_NAME.length + 1) : null;
}

export async function createSessionCookie(env, user = null) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = user ? `user:${user.id}:${expires}` : `staff:${expires}`;
  const sig = await sign(env, payload);
  if (!sig) return null;
  return `${COOKIE_NAME}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function getSession(context) {
  const token = readCookie(context.request);
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await sign(context.env, payload);
  if (!expected || expected !== sig) return null;
  const parts = payload.split(":");
  const expires = Number(parts.at(-1));
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return null;
  if (parts[0] === "staff") return { id: "staff", name: "Rica Spa Staff", email: "staff@ricaspa.beauty", role: "employee", legacy: true };
  if (parts[0] !== "user" || !parts[1] || !context.env.DB) return null;
  const row = await context.env.DB.prepare("SELECT id,name,email,role,status FROM dashboard_users WHERE id = ?1").bind(parts[1]).first();
  if (!row || row.status !== "active") return null;
  return row;
}

export async function isAuthenticated(context) {
  return !!(await getSession(context));
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, key, 256);
  const toHex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2$120000$${toHex(salt)}$${toHex(bits)}`;
}

export async function verifyPassword(password, encoded) {
  const [, iterations, saltHex, hashHex] = String(encoded || "").split("$");
  if (!iterations || !saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((x) => parseInt(x, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: Number(iterations), hash: "SHA-256" }, key, 256);
  const actual = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return actual === hashHex;
}
