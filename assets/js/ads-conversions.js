// Fires Google Ads conversion events for form submissions on this
// (AJAX/SPA-style) site. Google Ads' own instructions assume a dedicated
// "thank you" page to drop the event snippet on — this site doesn't have
// one (validate.js shows an inline success message instead of navigating
// anywhere), so this listens for the custom 'rica:form-success' event
// validate.js dispatches on the real "OK" response instead. Same trigger
// condition Google's snippet would have had, just wired to fit this site's
// actual submission flow rather than a page load.
//
// Each form is matched by its `action` attribute, since that's already
// unique per form and doesn't require adding IDs/classes just for this.

document.addEventListener('rica:form-success', function (event) {
  if (typeof gtag !== 'function') return; // gtag.js blocked/not loaded (ad blocker, etc.) — nothing to do
  const action = event.detail && event.detail.action;

  if (action === '/api/book-session') {
    gtag('event', 'conversion', {
      'send_to': 'AW-16973029826/LKJ1CPj9_s0cEMLDr50_',
      'value': 1.0,
      'currency': 'USD',
    });
    return;
  }

  // Contact form (/api/contact-message) and voucher purchases both still
  // need their own conversion action created in Google Ads (Tools &
  // Settings → Conversions) before a label exists to fire here — not a
  // code gap, just waiting on that label. Once you have it, add another
  // `if (action === '/api/contact-message') { ... }` block the same shape
  // as the one above. Voucher purchases don't go through validate.js at
  // all (different checkout flow in vouchers.html/voucher.js), so that one
  // needs its own gtag call at the point voucher.js confirms payment
  // succeeded, not here.
});
