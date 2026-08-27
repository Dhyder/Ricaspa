const SESSION_TTL_SECONDS = 60 * 60 * 8;
const COOKIE_NAME = "rica_dash_session";

function hex(bytes) { return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
function readCookie(request) {
  const header = request.headers.get("Cookie") || "";
  const match = header.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) : null;
}
export async function createSessionCookie(env, user) {
  if (!env.DB || !user?.id) return null;
  const token = hex(crypto.getRandomValues(new Uint8Array(32))), now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  await env.DB.prepare("INSERT INTO dashboard_sessions (id,user_id,expires_at,created_at,last_seen_at) VALUES (?1,?2,?3,?4,?4)").bind(token,user.id,expires.toISOString(),now.toISOString()).run();
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}
export function clearSessionCookie() { return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`; }
export async function getSession(context) {
  const token = readCookie(context.request);
  if (!token || !context.env.DB) return null;
  const row = await context.env.DB.prepare("SELECT u.id,u.name,u.email,u.role,u.status FROM dashboard_sessions s JOIN dashboard_users u ON u.id=s.user_id WHERE s.id=?1 AND s.expires_at>?2 AND u.status='active'").bind(token,new Date().toISOString()).first();
  if (!row) return null;
  await context.env.DB.prepare("UPDATE dashboard_sessions SET last_seen_at=?2 WHERE id=?1").bind(token,new Date().toISOString()).run();
  return row;
}
export async function isAuthenticated(context) { return !!(await getSession(context)); }
export async function requireSession(context) { const user=await getSession(context); if(!user) throw new Error("Not authorized"); return user; }
export async function requireRole(context, roles) { const user=await requireSession(context); const allowed=Array.isArray(roles)?roles:[roles]; if(!allowed.includes(user.role)) throw new Error("Forbidden"); return user; }
export async function destroySession(context) { const token=readCookie(context.request); if(token&&context.env.DB) await context.env.DB.prepare("DELETE FROM dashboard_sessions WHERE id=?1").bind(token).run(); }
export async function audit(env,user,action,entityType=null,entityId=null,metadata=null) { if(!env.DB)return; await env.DB.prepare("INSERT INTO dashboard_audit_log (user_id,action,entity_type,entity_id,metadata,created_at) VALUES (?1,?2,?3,?4,?5,?6)").bind(user?.id||null,action,entityType,entityId,metadata?JSON.stringify(metadata):null,new Date().toISOString()).run(); }
export async function hashPassword(password) { const salt=crypto.getRandomValues(new Uint8Array(16)); const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]); const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:120000,hash:"SHA-256"},key,256); return `pbkdf2$120000$${hex(salt)}$${hex(bits)}`; }
export async function verifyPassword(password,encoded) { const [,iterations,saltHex,hashHex]=String(encoded||"").split("$"); if(!iterations||!saltHex||!hashHex)return false; const pairs=saltHex.match(/.{2}/g); if(!pairs)return false; const salt=new Uint8Array(pairs.map(x=>parseInt(x,16))); const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]); const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:Number(iterations),hash:"SHA-256"},key,256); return hex(bits)===hashHex; }
