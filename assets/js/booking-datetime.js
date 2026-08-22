// Booking-form date/time restrictions only. Submission itself is handled
// by assets/vendor/php-email-form/validate.js (the generic handler already
// loaded for every .php-email-form on the page) — this file does NOT
// attach its own submit listener or clone/replace the form node, so it
// can't shadow that handler. It only tightens the date/time <input>
// constraints so people can't pick a slot outside business hours.
//
// (Previously this file was a Web3Forms integration — MinimalFormHandler —
// that cloned each form to strip validate.js's listener and posted to a
// third-party API with a hardcoded public access key. Removed in favor of
// the site's own /api/book-session + /api/contact-message Cloudflare
// Functions, consistent with how vouchers/payments are handled.)

document.addEventListener('DOMContentLoaded', function () {
  const bookingForm = document.querySelector('form[action="/api/book-session"]');
  if (!bookingForm) return;

  const dateInput = bookingForm.querySelector('input[name="date"]');
  const timeInput = bookingForm.querySelector('input[name="time"]');

  // 1. No past dates; cap how far ahead people can book.
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);

    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    dateInput.setAttribute('max', maxDate.toISOString().split('T')[0]);

    dateInput.addEventListener('change', function () {
      if (this.value && this.value < today) {
        alert('⚠️ Cannot book past dates. Please select today or a future date.');
        this.value = '';
      }
      if (timeInput && timeInput.value) {
        timeInput.dispatchEvent(new Event('change'));
      }
    });
  }

  // 2. Business hours only, in 15-minute steps, with a 1-hour lead time
  //    for same-day bookings.
  if (timeInput) {
    timeInput.setAttribute('min', '08:00');
    timeInput.setAttribute('max', '23:30');
    timeInput.setAttribute('step', '900');
    if (!timeInput.placeholder) timeInput.placeholder = '08:00 - 23:30';

    timeInput.addEventListener('change', function () {
      const selectedTime = this.value;
      if (!selectedTime) return;

      const [hours, minutes] = selectedTime.split(':').map(Number);
      const timeInMinutes = hours * 60 + minutes;
      const openingTime = 8 * 60;
      const closingTime = 23 * 60 + 30;

      if (timeInMinutes < openingTime || timeInMinutes > closingTime) {
        alert('⚠️ Bookings are only available between 08:00 and 23:30.');
        this.value = '';
        return;
      }

      if (dateInput && dateInput.value) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDate = new Date(dateInput.value);

        if (selectedDate.getTime() === today.getTime()) {
          const now = new Date();
          const minimumBookingTime = now.getHours() * 60 + now.getMinutes() + 60;
          if (timeInMinutes < minimumBookingTime) {
            const minHour = Math.floor(minimumBookingTime / 60);
            const minMinute = minimumBookingTime % 60;
            alert(`⚠️ For today's bookings, please select a time at least 1 hour from now.\n\nEarliest available: ${String(minHour).padStart(2, '0')}:${String(minMinute).padStart(2, '0')}`);
            this.value = '';
          }
        }
      }
    });
  }

  if (dateInput && !dateInput.placeholder) dateInput.placeholder = 'Select date';
});
