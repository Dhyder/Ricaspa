// Rica Spa — Voucher form logic
(function () {
  const formView = document.getElementById('voucherFormView');
  const statusView = document.getElementById('paymentStatusView');
  if (!formView) return; // section not on this page

  // --- Returning from IntaSend checkout? Poll for completion instead of
  //     showing the form. ------------------------------------------------
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');

  if (ref) {
    formView.style.display = 'none';
    statusView.style.display = '';
    pollOrderStatus(ref);
  }

  async function pollOrderStatus(ref, attempt = 0) {
    const textEl = document.getElementById('paymentStatusText');
    try {
      const res = await fetch('/api/order-status?ref=' + encodeURIComponent(ref));
      const data = await res.json();

      if (data.status === 'completed') {
        textEl.textContent = 'Payment confirmed. Your voucher has been emailed — check your inbox.';
        return;
      }
      if (data.status === 'failed') {
        textEl.textContent = 'This payment did not go through. No voucher was created. You can try again below.';
        setTimeout(() => {
          statusView.style.display = 'none';
          formView.style.display = '';
        }, 4000);
        return;
      }
      // still pending — keep polling for up to ~30s
      if (attempt < 15) {
        setTimeout(() => pollOrderStatus(ref, attempt + 1), 2000);
      } else {
        textEl.textContent = "Still confirming with IntaSend — this can take a minute. Refresh this page shortly to check again.";
      }
    } catch {
      textEl.textContent = 'Could not check payment status. Refresh this page to try again.';
    }
  }

  // --- Normal form flow ---------------------------------------------------
  const form = document.getElementById('voucherForm');

  const SERVICES = [
    { name: 'Swedish Massage (1 Hour)', price: 3000 },
    { name: 'Deep Tissue Massage (1 Hour)', price: 4000 },
    { name: 'Sports & Thai Massage', price: 5000 },
    { name: 'Foam Massage (1 Hour)', price: 4000 },
    { name: 'Aromatherapy Massage', price: 5000, priceDisplay: 'KES 5,000 – 8,000' },
    { name: 'Hot Stone Massage (90 Minutes)', price: 6000 },
    { name: 'Prenatal Massage', price: 5000 },
    { name: 'Four Hands Massage', price: 6000 },
    { name: 'Back Massage (30 Minutes)', price: 2500 },
    { name: 'Foot Massage (20 Minutes)', price: 2000 },
    { name: 'Head Massage (20 Minutes)', price: 2000 },
    { name: 'Steam Bath', price: 2000 },
    { name: 'Moroccan Bath Ritual', price: 12000 },
  ];

  let currentType = 'amount';

  const serviceSelect = document.getElementById('serviceSelect');
  SERVICES.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.dataset.price = s.price;
    opt.textContent = `${s.name} — ${s.priceDisplay || 'KES ' + s.price.toLocaleString()}`;
    serviceSelect.appendChild(opt);
  });

  function updateServicePriceDisplay() {
    const opt = serviceSelect.selectedOptions[0];
    document.getElementById('servicePriceDisplay').textContent = opt
      ? 'Voucher value: KES ' + Number(opt.dataset.price).toLocaleString()
      : '';
  }
  serviceSelect.addEventListener('change', updateServicePriceDisplay);

  document.querySelectorAll('.rv-type').forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rv-type').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;

      document.getElementById('amountField').style.display = currentType === 'amount' ? '' : 'none';
      document.getElementById('serviceField').style.display = currentType === 'service' ? '' : 'none';

      if (currentType === 'service') updateServicePriceDisplay();
    });
  });
  updateServicePriceDisplay();

  const giftOthersCheckbox = document.getElementById('giftOthers');
  const recipientFields = document.getElementById('recipientFields');

  function updateGiftMode() {
    recipientFields.style.display = giftOthersCheckbox.checked ? '' : 'none';
    document.getElementById('toName').required = giftOthersCheckbox.checked;
  }
  giftOthersCheckbox.addEventListener('change', updateGiftMode);
  updateGiftMode();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('voucherStatus');
    const submitBtn = document.getElementById('voucherSubmitBtn');
    statusEl.textContent = '';
    statusEl.className = 'status-msg';
    submitBtn.disabled = true;

    const buyerName = document.getElementById('buyerName').value;
    const giftingOthers = giftOthersCheckbox.checked;
    const testMode = document.getElementById('testMode').checked;

    const payload = {
      type: currentType,
      value: currentType === 'service' ? serviceSelect.value : document.getElementById('valueInput').value,
      buyerName,
      buyerEmail: document.getElementById('buyerEmail').value,
      buyerPhone: document.getElementById('buyerPhone').value,
      giftingOthers,
      toName: giftingOthers ? document.getElementById('toName').value : buyerName,
      recipientEmail: giftingOthers ? document.getElementById('recipientEmail').value : '',
      fromName: giftingOthers ? buyerName : 'Rica Spa',
      message: document.getElementById('voucherMessage').value,
      testMode,
    };

    try {
      if (testMode) {
        submitBtn.textContent = 'Sending...';
        const res = await fetch('/api/create-voucher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok) {
          statusEl.classList.add('error');
          statusEl.textContent = data.error || 'Something went wrong.';
        } else {
          statusEl.classList.add('success');
          statusEl.textContent = `Voucher sent. Code: ${data.code}`;
          form.reset();
          updateGiftMode();
          updateServicePriceDisplay();
        }
      } else {
        submitBtn.textContent = 'Redirecting to payment...';
        const res = await fetch('/api/initiate-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok) {
          statusEl.classList.add('error');
          statusEl.textContent = data.error || 'Could not start payment.';
        } else {
          window.location.href = data.redirectUrl;
          return; // leaving the page
        }
      }
    } catch (err) {
      statusEl.classList.add('error');
      statusEl.textContent = 'Network error, please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Get voucher';
    }
  });
})();
