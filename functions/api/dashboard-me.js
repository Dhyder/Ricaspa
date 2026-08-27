import { json } from "../_lib/voucherCore.js";
import { getSession } from "../_lib/dashboardAuth.js";

export async function onRequestGet(context) {
  const user = await getSession(context);
  if (!user) return json({ error: "Not authenticated" }, 401);
  return json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
