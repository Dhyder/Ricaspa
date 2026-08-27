import { json } from "../_lib/voucherCore.js";
import { requireSession } from "../_lib/dashboardAuth.js";

export async function onRequestGet(c) {
  try {
    await requireSession(c);
    if (!c.env.VOUCHERS) return json({ vouchers: [], error: "Voucher storage is not configured" }, 503);
    const out = [];
    let cursor;
    do {
      const page = await c.env.VOUCHERS.list({ cursor, limit: 1000 });
      for (const key of page.keys || []) {
        if (key.name.startsWith("voucher-ref:")) continue;
        const raw = await c.env.VOUCHERS.get(key.name);
        if (!raw) continue;
        try {
          const v = JSON.parse(raw);
          out.push({
            code: v.code || key.name,
            ref: v.ref || null,
            buyerName: v.buyerName || null,
            buyerEmail: v.buyerEmail || null,
            buyerPhone: v.buyerPhone || null,
            toName: v.toName || null,
            serviceName: v.serviceName || null,
            type: v.type || null,
            value: v.value ?? null,
            status: v.status || "unredeemed",
            createdAt: v.createdAt || null,
            expiresAt: v.expiresAt || null,
            redeemedAt: v.redeemedAt || null,
            redeemedBy: v.redeemedBy || null,
          });
        } catch {}
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    out.sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return json({ vouchers: out });
  } catch (e) {
    return json({ error: e.message }, e.message === "Forbidden" ? 403 : 401);
  }
}
