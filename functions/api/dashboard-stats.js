// GET /api/dashboard-stats?from=YYYY-MM-DD&to=YYYY-MM-DD
// Session-cookie protected (see dashboardAuth.js). Powers the dashboard
// overview page: voucher revenue/order stats plus booking stats, both
// bucketed by day so the frontend can chart them directly.

import { json } from "../_lib/voucherCore.js";
import { isAuthenticated } from "../_lib/dashboardAuth.js";
import { getStatsSummary } from "../_lib/ledger.js";
import { getBookingStatsSummary } from "../_lib/bookingLedger.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await isAuthenticated(context))) {
    return json({ error: "Not authenticated" }, 401);
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  try {
    const [orders, bookings] = await Promise.all([
      getStatsSummary(env, { from, to }),
      getBookingStatsSummary(env, { from, to }),
    ]);
    return json({ orders, bookings });
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
}
