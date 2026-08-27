// GET /api/dashboard-orders?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200
// Session-cookie protected. Backs the dashboard's vouchers/orders table.

import { json } from "../_lib/voucherCore.js";
import { isAuthenticated } from "../_lib/dashboardAuth.js";
import { listOrders } from "../_lib/ledger.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await isAuthenticated(context))) {
    return json({ error: "Not authenticated" }, 401);
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  const limit = Number(url.searchParams.get("limit")) || 200;

  try {
    const orders = await listOrders(env, { from, to, limit });
    return json({ orders });
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
}
