var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// _lib/voucherCore.js
var SERVICES = {
  "Swedish Massage (1 Hour)": 3e3,
  "Deep Tissue Massage (1 Hour)": 4e3,
  "Sports & Thai Massage": 5e3,
  "Foam Massage (1 Hour)": 4e3,
  "Aromatherapy Massage": 5e3,
  "Hot Stone Massage (90 Minutes)": 6e3,
  "Prenatal Massage": 5e3,
  "Four Hands Massage": 6e3,
  "Back Massage (30 Minutes)": 2500,
  "Foot Massage (20 Minutes)": 2e3,
  "Head Massage (20 Minutes)": 2e3,
  "Steam Bath": 2e3,
  "Moroccan Bath Ritual": 12e3
};
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "RICA-";
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
__name(generateCode, "generateCode");
function generateRef() {
  return "RS" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}
__name(generateRef, "generateRef");
function resolveVoucherOrder(body) {
  const {
    type,
    value,
    buyerName,
    buyerEmail,
    buyerPhone,
    giftingOthers,
    toName,
    recipientEmail,
    fromName,
    message
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
    if (price === void 0) return { error: "Unknown service selected" };
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
      recipientEmail: giftingOthers ? recipientEmail || null : null,
      fromName: giftingOthers ? fromName || buyerName : "Rica Spa",
      message: message || ""
    }
  };
}
__name(resolveVoucherOrder, "resolveVoucherOrder");
async function finalizeVoucher(env, order) {
  const code = generateCode();
  const expires = /* @__PURE__ */ new Date();
  expires.setMonth(expires.getMonth() + 6);
  const expiresDisplay = expires.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const record = {
    code,
    ...order,
    status: "unredeemed",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    expiresAt: expires.toISOString()
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
    expiresDisplay
  });
  const recipients = record.giftingOthers && record.recipientEmail ? [record.recipientEmail] : [record.buyerEmail];
  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Rica Spa <vouchers@ricaspa.beauty>",
      to: recipients,
      subject: "Your Rica Spa voucher is here",
      html
    })
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
        code
      });
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "Rica Spa <vouchers@ricaspa.beauty>",
          to: [record.buyerEmail],
          subject: `Your gift to ${record.toName} is on its way`,
          html: confirmHtml
        })
      });
    } catch {
    }
  }
  return { code, record };
}
__name(finalizeVoucher, "finalizeVoucher");
function labelFor(type) {
  if (type === "amount") return "Voucher value";
  return "Included treatment";
}
__name(labelFor, "labelFor");
function displayValue(type, value, serviceName) {
  if (type === "amount") return `KES ${Number(value).toLocaleString()}`;
  return serviceName || value;
}
__name(displayValue, "displayValue");
function buildVoucherEmail({ type, value, serviceName, toName, fromName, message, code, expiresDisplay }) {
  const valueLabel = labelFor(type);
  const valueText = displayValue(type, value, serviceName);
  const subText = type === "service" ? `Worth KES ${Number(value).toLocaleString()}` : null;
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
__name(buildVoucherEmail, "buildVoucherEmail");
function buildConfirmationEmail({ buyerName, toName, recipientEmail, type, value, serviceName, code }) {
  const valueText = type === "amount" ? `KES ${Number(value).toLocaleString()}` : `${escapeHtml(serviceName || value)} (worth KES ${Number(value).toLocaleString()})`;
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
__name(buildConfirmationEmail, "buildConfirmationEmail");
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
__name(escapeHtml, "escapeHtml");
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(json, "json");

// api/create-voucher.js
async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  if (!body.testMode) {
    return json(
      { error: "This endpoint is test-mode only. Use /api/initiate-payment for real purchases." },
      400
    );
  }
  const { error, order } = resolveVoucherOrder(body);
  if (error) return json({ error }, 400);
  try {
    const { code } = await finalizeVoucher(env, order);
    return json({ success: true, code });
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
}
__name(onRequestPost, "onRequestPost");

// _lib/intasend.js
var BASE_URL = "https://api.intasend.com";
async function createCheckout(env, { ref, amount, description, callbackUrl, billing }) {
  const res = await fetch(`${BASE_URL}/api/v1/checkout/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-IntaSend-Public-API-Key": env.INTASEND_PUBLISHABLE_KEY
    },
    body: JSON.stringify({
      amount,
      currency: "KES",
      api_ref: ref,
      redirect_url: callbackUrl,
      email: billing.email,
      phone_number: billing.phone || "",
      first_name: billing.firstName || billing.name || "Guest",
      last_name: billing.lastName || "",
      comment: description
    })
  });
  const data = await res.json();
  if (!res.ok || !data.url) {
    throw new Error("IntaSend checkout creation failed: " + JSON.stringify(data));
  }
  return data;
}
__name(createCheckout, "createCheckout");
async function checkStatus(env, { checkoutId, signature }) {
  const res = await fetch(`${BASE_URL}/api/v1/payment/status/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${env.INTASEND_SECRET_KEY}`
    },
    body: JSON.stringify({ checkout_id: checkoutId, signature })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error("IntaSend status check failed: " + JSON.stringify(data));
  }
  return data;
}
__name(checkStatus, "checkStatus");

// api/initiate-payment.js
async function onRequestPost2(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const { error, order } = resolveVoucherOrder(body);
  if (error) return json({ error }, 400);
  const ref = generateRef();
  const description = order.type === "amount" ? `Rica Spa gift voucher \u2014 KES ${order.value}` : `Rica Spa voucher \u2014 ${order.serviceName}`;
  try {
    const checkout = await createCheckout(env, {
      ref,
      amount: Number(order.value),
      description,
      callbackUrl: `https://ricaspa.beauty/vouchers?ref=${ref}`,
      billing: {
        email: order.buyerEmail,
        phone: order.buyerPhone,
        name: order.buyerName
      }
    });
    await env.VOUCHERS.put(
      `pending:${ref}`,
      JSON.stringify({
        order,
        checkoutId: checkout.id,
        signature: checkout.signature
      }),
      { expirationTtl: 60 * 60 * 2 }
      // pending orders expire after 2 hours if unpaid
    );
    return json({ success: true, ref, redirectUrl: checkout.url });
  } catch (err) {
    return json({ error: "Could not start payment", detail: String(err) }, 502);
  }
}
__name(onRequestPost2, "onRequestPost");

// api/order-status.js
async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref");
  if (!ref) return json({ error: "Missing ref" }, 400);
  const pendingRaw = await env.VOUCHERS.get(`pending:${ref}`);
  if (!pendingRaw) {
    return json({ status: "completed" });
  }
  try {
    const { checkoutId, signature } = JSON.parse(pendingRaw);
    const result = await checkStatus(env, { checkoutId, signature });
    const state = result?.invoice?.state;
    if (state === "FAILED" || state === "CANCELED") {
      return json({ status: "failed" });
    }
  } catch {
  }
  return json({ status: "pending" });
}
__name(onRequestGet, "onRequestGet");

// api/payment-webhook.js
async function onRequestPost3(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid body", { status: 400 });
  }
  const { challenge, state, api_ref: ref } = body;
  if (challenge !== env.INTASEND_WEBHOOK_CHALLENGE) {
    return new Response("Invalid challenge", { status: 401 });
  }
  if (!ref) {
    return new Response("Missing api_ref", { status: 400 });
  }
  if (state !== "COMPLETE") {
    return new Response("OK", { status: 200 });
  }
  try {
    const pendingRaw = await env.VOUCHERS.get(`pending:${ref}`);
    if (!pendingRaw) {
      return new Response("OK", { status: 200 });
    }
    const { order } = JSON.parse(pendingRaw);
    await finalizeVoucher(env, order);
    await env.VOUCHERS.delete(`pending:${ref}`);
    return new Response("OK", { status: 200 });
  } catch (err) {
    return new Response("Error: " + String(err), { status: 500 });
  }
}
__name(onRequestPost3, "onRequestPost");

// ../.wrangler/tmp/pages-VM94Cd/functionsRoutes-0.38762184242014586.mjs
var routes = [
  {
    routePath: "/api/create-voucher",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/initiate-payment",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/order-status",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/payment-webhook",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  }
];

// ../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
