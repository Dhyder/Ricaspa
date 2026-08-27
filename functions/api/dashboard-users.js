import { json } from "../_lib/voucherCore.js";
import { requireRole, hashPassword, audit } from "../_lib/dashboardAuth.js";

const validEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

export async function onRequestGet(context) {
  try {
    await requireRole(context, "superuser");
    const { results = [] } = await context.env.DB.prepare("SELECT id,name,email,role,status,created_at,last_login_at FROM dashboard_users ORDER BY created_at DESC").all();
    return json({ users: results });
  } catch (err) { return json({ error: err.message === "Forbidden" ? "Forbidden" : "Not authorized" }, err.message === "Forbidden" ? 403 : 401); }
}

export async function onRequestPost(context) {
  try {
    const actor = await requireRole(context, "superuser");
    const body = await context.request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = body.role === "superuser" ? "superuser" : "employee";
    if (name.length < 2 || !validEmail(email) || password.length < 8) return json({ error: "Name, valid email and an 8+ character password are required" }, 400);
    if (role === "superuser" && actor.role !== "superuser") return json({ error: "Forbidden" }, 403);
    const exists = await context.env.DB.prepare("SELECT id FROM dashboard_users WHERE email=?1").bind(email).first();
    if (exists) return json({ error: "An account with that email already exists" }, 409);
    const id = crypto.randomUUID(), now = new Date().toISOString();
    await context.env.DB.prepare("INSERT INTO dashboard_users (id,name,email,password_hash,role,status,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,'active',?6,?6)").bind(id,name,email,await hashPassword(password),role,now).run();
    await audit(context.env, actor, "user_created", "dashboard_user", id, { email, role });
    return json({ ok: true, user: { id,name,email,role,status: "active" } }, 201);
  } catch (err) { return json({ error: err.message === "Forbidden" ? "Forbidden" : "Not authorized" }, err.message === "Forbidden" ? 403 : 401); }
}

export async function onRequestPatch(context) {
  try {
    const actor = await requireRole(context, "superuser");
    const body = await context.request.json();
    const id = String(body.id || "");
    if (!id || id === actor.id) return json({ error: "You cannot modify your own account here" }, 400);
    const existing = await context.env.DB.prepare("SELECT id,name,email,role,status FROM dashboard_users WHERE id=?1").bind(id).first();
    if (!existing) return json({ error: "User not found" }, 404);
    const status = ["active","pending","disabled"].includes(body.status) ? body.status : existing.status;
    const role = ["employee","superuser"].includes(body.role) ? body.role : existing.role;
    const name = body.name ? String(body.name).trim() : existing.name;
    const now = new Date().toISOString();
    await context.env.DB.prepare("UPDATE dashboard_users SET name=?2,role=?3,status=?4,updated_at=?5 WHERE id=?1").bind(id,name,role,status,now).run();
    if (status !== "active") await context.env.DB.prepare("DELETE FROM dashboard_sessions WHERE user_id=?1").bind(id).run();
    await audit(context.env, actor, "user_updated", "dashboard_user", id, { role, status });
    return json({ ok: true });
  } catch (err) { return json({ error: err.message === "Forbidden" ? "Forbidden" : "Not authorized" }, err.message === "Forbidden" ? 403 : 401); }
}
