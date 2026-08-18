// Shared voucher logic: service catalog, code generation, email templates,
// and the "finalize" step (save to KV + send emails) used by both the
// test-mode endpoint and the real Pesapal payment flow.

// Keep this list in sync with SERVICES in assets/js/voucher.js
export const SERVICES = {
  'Swedish Massage (1 Hour)': 3000,
  'Deep Tissue Massage (1 Hour)': 4000,
  'Sports & Thai Massage': 5000,
  'Foam Massage (1 Hour)': 4000,
  'Aromatherapy Massage': 5000,
  'Hot Stone Massage (90 Minutes)': 6000,
  'Prenatal Massage': 5000,
  'Four Hands Massage': 6000,
  'Back Massage (30 Minutes)': 2500,
  'Foot Massage (20 Minutes)': 2000,
  'Head Massage (20 Minutes)': 2000,
  'Steam Bath': 2000,
  'Moroccan Bath Ritual': 12000,
};

export function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "RICA-";
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateRef() {
  // Merchant reference for Pesapal orders — must be unique, kept short.
  return "RS" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

// Validates + resolves a submitted voucher payload into a clean order shape.
// Returns { error } or { order }.
export function resolveVoucherOrder(body) {
  const {
    type, value, buyerName, buyerEmail, buyerPhone,
    giftingOthers, toName, recipientEmail, fromName, message,
  } = body;

  if (!buyerEmail || !buyerName || !value || !type) {
    return { error: "Missing required fields" };
  }
  if (type === "discount") {
    return { error: "Discount vouchers aren't available yet" };
  }
  if (type !== "amount" && type !== "service") {
    return { error: "Invalid voucher type" };
  }

  let resolvedValue = value;
  if (type === "service") {
    const price = SERVICES[value];
    if (price === undefined) return { error: "Unknown service selected" };
    resolvedValue = String(price);
  } else {
    const numeric = Number(value);
    if (!numeric || numeric < 500) return { error: "Enter a valid voucher amount" };
    resolvedValue = String(numeric);
  }

  if (giftingOthers && !toName) {
    return { error: "Recipient name is required for gifts" };
  }

  return {
    order: {
      type,
      value: resolvedValue,
      serviceName: type === "service" ? value : null,
      buyerName,
      buyerEmail,
      buyerPhone: buyerPhone || "",
      giftingOthers: Boolean(giftingOthers),
      toName: giftingOthers ? toName : buyerName,
      recipientEmail: giftingOthers ? (recipientEmail || null) : null,
      fromName: giftingOthers ? (fromName || buyerName) : "Rica Spa",
      message: message || "",
    },
  };
}

// Generates the code, stores the voucher in KV, and emails it out.
// `order` is the shape returned by resolveVoucherOrder().
export async function finalizeVoucher(env, order) {
  const code = generateCode();
  const expires = new Date();
  expires.setMonth(expires.getMonth() + 6);
  const expiresDisplay = expires.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const record = {
    code,
    ...order,
    status: "unredeemed",
    createdAt: new Date().toISOString(),
    expiresAt: expires.toISOString(),
  };

  await env.VOUCHERS.put(code, JSON.stringify(record));

  const html = buildVoucherEmail({
    type: record.type,
    value: record.value,
    serviceName: record.serviceName,
    toName: record.toName,
    fromName: record.fromName,
    message: record.message,
    code,
    expiresDisplay,
  });

  const recipients =
    record.giftingOthers && record.recipientEmail
      ? [record.recipientEmail]
      : [record.buyerEmail];

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Rica Spa <vouchers@ricaspa.beauty>",
      to: recipients,
      subject: "Your Rica Spa voucher is here",
      html,
    }),
  });

  if (!emailRes.ok) {
    const detail = await emailRes.text();
    throw new Error("Voucher saved but email failed to send: " + detail);
  }

  const wentToRecipientOnly = record.giftingOthers && record.recipientEmail;
  if (wentToRecipientOnly) {
    try {
      const confirmHtml = buildConfirmationEmail({
        buyerName: record.buyerName,
        toName: record.toName,
        recipientEmail: record.recipientEmail,
        type: record.type,
        value: record.value,
        serviceName: record.serviceName,
        code,
      });

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Rica Spa <vouchers@ricaspa.beauty>",
          to: [record.buyerEmail],
          subject: `Your gift to ${record.toName} is on its way`,
          html: confirmHtml,
        }),
      });
    } catch {
      // Voucher itself already delivered — don't fail on the confirmation copy.
    }
  }

  return { code, record };
}

function labelFor(type) {
  if (type === "amount") return "Voucher value";
  return "Included treatment";
}

function displayValue(type, value, serviceName) {
  if (type === "amount") return `KES ${Number(value).toLocaleString()}`;
  return serviceName || value;
}

export function buildVoucherEmail({ type, value, serviceName, toName, fromName, message, code, expiresDisplay }) {
  const valueLabel = labelFor(type);
  const valueText = displayValue(type, value, serviceName);
  const subText = type === "service"
    ? `Worth KES ${Number(value).toLocaleString()}`
    : null;

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#EDE4CF;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" style="max-width:600px;margin:0 auto;" cellpadding="0" cellspacing="0">
    <tr>
      <td style="background:#16241C;border-radius:12px;padding:0;overflow:hidden;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:32px 32px 8px;">
              <div style="color:#B9924A;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Rica Spa</div>
              <div style="color:rgba(248,243,230,0.6);font-size:11px;letter-spacing:1px;margin-top:2px;">Westlands, Nairobi</div>
              <div style="color:#F8F3E6;font-size:26px;font-weight:bold;margin-top:20px;line-height:1.3;">
                A gift, waiting for ${escapeHtml(toName)}
              </div>
              <div style="color:rgba(248,243,230,0.82);font-size:14px;line-height:1.6;margin-top:12px;">
                ${escapeHtml(message || "A little pause, on us. Redeemable at Rica Spa, Westlands.")}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1F3327;border-radius:8px;">
                <tr>
                  <td style="padding:20px;text-align:center;">
                    <div style="color:rgba(248,243,230,0.5);font-size:10px;letter-spacing:2px;text-transform:uppercase;">${valueLabel}</div>
                    <div style="color:#B9924A;font-size:28px;font-weight:bold;margin-top:6px;">${escapeHtml(valueText)}</div>
                    ${subText ? `<div style="color:rgba(248,243,230,0.6);font-size:12px;margin-top:2px;">${escapeHtml(subText)}</div>` : ""}
                    <div style="margin-top:14px;display:inline-block;background:rgba(248,243,230,0.08);border:1px solid rgba(248,243,230,0.2);border-radius:5px;padding:8px 14px;color:#F8F3E6;font-family:monospace;font-size:15px;letter-spacing:1px;">
                      ${code}
                    </div>
                    <div style="color:rgba(248,243,230,0.55);font-size:11px;margin-top:10px;">Valid until ${expiresDisplay}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <div style="color:rgba(248,243,230,0.5);font-size:11px;">From ${escapeHtml(fromName)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 12px;text-align:center;color:#7a715c;font-size:11px;line-height:1.6;">
        Present this code at reception or quote it when booking via WhatsApp.<br>
        Non-refundable. Not exchangeable for cash. One voucher per visit.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildConfirmationEmail({ buyerName, toName, recipientEmail, type, value, serviceName, code }) {
  const valueText = type === "amount"
    ? `KES ${Number(value).toLocaleString()}`
    : `${escapeHtml(serviceName || value)} (worth KES ${Number(value).toLocaleString()})`;

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#EDE4CF;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;" cellpadding="0" cellspacing="0">
    <tr>
      <td style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #ddd2b6;">
        <div style="color:#B9924A;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Rica Spa</div>
        <div style="color:#16241C;font-size:22px;font-weight:bold;margin-top:14px;">
          Delivered to ${escapeHtml(toName)}
        </div>
        <div style="color:#4a4436;font-size:14px;line-height:1.6;margin-top:12px;">
          Hi ${escapeHtml(buyerName)}, your voucher for ${escapeHtml(toName)} has been emailed directly to
          ${escapeHtml(recipientEmail)}.
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:#EDE4CF;border-radius:8px;">
          <tr>
            <td style="padding:16px 18px;">
              <div style="color:#7a715c;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Voucher</div>
              <div style="color:#16241C;font-size:16px;font-weight:bold;margin-top:4px;">${valueText}</div>
              <div style="color:#7a715c;font-size:12px;margin-top:6px;font-family:monospace;">${code}</div>
            </td>
          </tr>
        </table>
        <div style="color:#7a715c;font-size:12px;margin-top:18px;">
          Keep this for your records. No action needed on your end.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
