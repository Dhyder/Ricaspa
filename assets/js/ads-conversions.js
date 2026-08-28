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
  const action = event.detail && event.detail.action;

  if (action === '/api/book-session') {
    if (typeof gtag === 'function') {
      gtag('event', 'conversion', {
        'send_to': 'AW-16973029826/R1P-CLaU3ugcEMLDr50_',
        'value': 1.0,
        'currency': 'USD',
      });
    }
    if (typeof fbq === 'function') {
      // 'Schedule' is Meta's standard event for booking an appointment —
      // lets Meta's ad delivery optimize for actual bookings, not just clicks.
      fbq('track', 'Schedule');
    }
    return;
  }

  if (action === '/api/contact-message') {
    if (typeof fbq === 'function') {
      fbq('track', 'Contact');
    }
    // Still needs its own Google Ads conversion label (Tools & Settings →
    // Conversions) before a gtag call can be added here the same shape as
    // the booking one above.
    return;
  }

  // Voucher purchases don't go through validate.js at all (different
  // checkout flow in vouchers.html/voucher.js) — both their Google Ads
  // conversion and Meta Pixel Purchase event fire from voucher.js at the
  // point payment is confirmed, not here.
});
