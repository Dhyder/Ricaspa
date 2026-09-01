(() => {
  const fired = (key) => { try { return sessionStorage.getItem(`rica_tiktok_${key}`) === "1"; } catch { return false; } };
  const mark = (key) => { try { sessionStorage.setItem(`rica_tiktok_${key}`, "1"); } catch {} };
  const track = (event, params = {}) => {
    if (!window.ttq || typeof window.ttq.track !== "function") return false;
    window.ttq.track(event, params);
    return true;
  };

  // Booking backend emits rica:form-success only after a real successful submission.
  window.addEventListener("rica:form-success", (event) => {
    if (fired("schedule")) return;
    const detail = event.detail || {};
    if (track("Schedule", {
      description: "Rica Spa booking request",
      content_type: "service",
      service: detail.service || detail.serviceName || undefined,
    })) mark("schedule");
  });

  // Voucher Purchase must be tied to confirmed payment, not the checkout button.
  // vouchers.html exposes ?ref=... after checkout; order-status is the source of truth.
  const ref = new URLSearchParams(location.search).get("ref");
  if (ref && !fired(`purchase_${ref}`)) {
    fetch(`/api/order-status?ref=${encodeURIComponent(ref)}`, { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : null)
      .then(status => {
        if (!status || status.status !== "completed") return;
        const amount = Number(status.value || status.order?.value || 0);
        if (track("Purchase", {
          content_type: "product",
          content_name: status.serviceName || "Rica Spa Gift Voucher",
          value: amount || undefined,
          currency: "KES",
          order_id: ref,
        })) mark(`purchase_${ref}`);
      }).catch(() => {});
  }
})();
