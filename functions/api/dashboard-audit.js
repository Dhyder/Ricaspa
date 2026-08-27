import { json } from "../_lib/voucherCore.js";
import { requireRole } from "../_lib/dashboardAuth.js";

export async function onRequestGet(context) {
  try {
    await requireRole(context, "superuser");
    const { results = [] } = await context.env.DB.prepare(`SELECT a.id,a.action,a.entity_type,a.entity_id,a.metadata,a.created_at,u.name AS user_name,u.email AS user_email FROM dashboard_audit_log a LEFT JOIN dashboard_users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200`).all();
    return json({ events: results });
  } catch (err) { return json({ error: err.message === "Forbidden" ? "Forbidden" : "Not authorized" }, err.message === "Forbidden" ? 403 : 401); }
}
