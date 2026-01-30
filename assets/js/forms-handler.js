// MINIMAL FORMS HANDLER - Pure functionality, zero styling changes
// Just handles form submission - uses your existing CSS

class MinimalFormHandler {
  constructor(formElement, accessKey) {
    this.form = formElement;
    this.accessKey = accessKey;
    this.loadingDiv = formElement.querySelector('.loading');
    this.errorDiv = formElement.querySelector('.error-message');
    this.successDiv = formElement.querySelector('.sent-message');
    this.submitBtn = formElement.querySelector('button[type="submit"]');
    
    this.init();
  }

  init() {
    // Remove any existing submit handlers to prevent conflicts
    const newForm = this.form.cloneNode(true);
    this.form.parentNode.replaceChild(newForm, this.form);
    this.form = newForm;
    
    // Re-get references after cloning
    this.loadingDiv = this.form.querySelector('.loading');
    this.errorDiv = this.form.querySelector('.error-message');
    this.successDiv = this.form.querySelector('.sent-message');
    this.submitBtn = this.form.querySelector('button[type="submit"]');
    
    // Add our submit handler
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  showLoading() {
    if (this.loadingDiv) this.loadingDiv.style.display = 'block';
    if (this.errorDiv) this.errorDiv.style.display = 'none';
    if (this.successDiv) this.successDiv.style.display = 'none';
    if (this.submitBtn) this.submitBtn.disabled = true;
  }

  showError(message) {
    if (this.loadingDiv) this.loadingDiv.style.display = 'none';
    if (this.errorDiv) {
      // Completely clear and rewrite the content
      this.errorDiv.innerHTML = '';
      this.errorDiv.style.display = 'block';
      // Make sure we're only showing the message, not the whole object
      if (typeof message === 'object') {
        this.errorDiv.textContent = message.message || 'Something went wrong. Please try again.';
      } else {
        this.errorDiv.textContent = message || 'Something went wrong. Please try again.';
      }
    }
    if (this.successDiv) this.successDiv.style.display = 'none';
    if (this.submitBtn) this.submitBtn.disabled = false;
  }

  showSuccess(message) {
    if (this.loadingDiv) this.loadingDiv.style.display = 'none';
    if (this.errorDiv) this.errorDiv.style.display = 'none';
    if (this.successDiv) {
      // Completely clear and rewrite the content
      this.successDiv.innerHTML = '';
      this.successDiv.style.display = 'block';
      // Make sure we're only showing the message, not the whole object
      if (typeof message === 'object') {
        this.successDiv.textContent = message.message || 'Your message has been sent successfully!';
      } else if (message) {
        this.successDiv.textContent = message;
      } else {
        // If no message, use default
        this.successDiv.textContent = 'Your message has been sent successfully!';
      }
    }
    if (this.submitBtn) this.submitBtn.disabled = false;
    
    // Reset form after 5 seconds
    setTimeout(() => {
      this.form.reset();
      if (this.successDiv) this.successDiv.style.display = 'none';
    }, 5000);
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    this.showLoading();

    const formData = new FormData(this.form);
    formData.append('access_key', this.accessKey);

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      // Debug logging
      console.log('Response status:', response.ok);
      console.log('Response data:', data);

      // Check if response is successful
      if (response.ok && data.success === true) {
        this.showSuccess(data.message || 'Your message has been sent successfully!');
      } else {
        // If we get here with success:true, something's wrong with our check
        if (data.success === true) {
          this.showSuccess(data.message || 'Your message has been sent successfully!');
        } else {
          this.showError(data.message || 'Failed to send message. Please try again.');
        }
      }
    } catch (error) {
      console.error('Form submission error:', error);
      this.showError('Network error. Please check your connection and try again.');
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  
  // Contact Form - try multiple selectors
  const contactForm = document.querySelector('form[action*="contact.php"]') || 
                      document.querySelector('form.php-email-form:not([action*="book"])');
  if (contactForm) {
    console.log('Contact form found:', contactForm);
    new MinimalFormHandler(contactForm, 'f5c05ada-a8ca-4222-bccf-a2a61169ee77');
  }

  // Booking Form - try multiple selectors
  const bookingForm = document.querySelector('form[action*="book-a-table.php"]') || 
                      document.querySelector('form[action*="book"]') ||
                      document.querySelector('form.php-email-form[action="#"]') ||
                      document.querySelector('form.php-email-form[action="https://api.web3forms.com/submit"]');
  
  if (bookingForm) {
    console.log('Booking form found:', bookingForm);
    new MinimalFormHandler(bookingForm, '152c4088-a50f-463f-bea6-ed753762819c');
    
    // === BOOKING TIME RESTRICTIONS ===
    const dateInput = bookingForm.querySelector('input[name="date"]');
    const timeInput = bookingForm.querySelector('input[name="time"]');
    
    // 1. Prevent past dates - set minimum to today
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.setAttribute('min', today);
      
      // Also set a reasonable max date (e.g., 3 months from now)
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 3);
      dateInput.setAttribute('max', maxDate.toISOString().split('T')[0]);
      
      // Validate when date changes
      dateInput.addEventListener('change', function() {
        const selectedDate = new Date(this.value);
        const todayDate = new Date(today);
        
        if (selectedDate < todayDate) {
          alert('⚠️ Cannot book past dates. Please select today or a future date.');
          this.value = '';
        }
      });
    }
    
    // 2. Restrict time to business hours: 08:00 - 23:30
    if (timeInput) {
      timeInput.setAttribute('min', '08:00');
      timeInput.setAttribute('max', '23:30');
      timeInput.setAttribute('step', '900'); // 15-minute intervals
      
      // Validate when time changes
      timeInput.addEventListener('change', function() {
        const selectedTime = this.value;
        
        if (!selectedTime) return;
        
        const [hours, minutes] = selectedTime.split(':').map(Number);
        const timeInMinutes = hours * 60 + minutes;
        
        // Business hours: 08:00 (480 min) to 23:30 (1410 min)
        const openingTime = 8 * 60; // 08:00 = 480 minutes
        const closingTime = 23 * 60 + 30; // 23:30 = 1410 minutes
        
        if (timeInMinutes < openingTime || timeInMinutes > closingTime) {
          alert('⚠️ Bookings are only available between 08:00 and 23:30.\n\nPlease select a time within our operating hours.');
          this.value = '';
          return;
        }
        
        // Additional check: If booking for today, ensure time is in the future
        if (dateInput && dateInput.value) {
          const selectedDate = new Date(dateInput.value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // If booking is for today
          if (selectedDate.getTime() === today.getTime()) {
            const now = new Date();
            const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
            
            // Add 1 hour buffer for preparation
            const minimumBookingTime = currentTimeInMinutes + 60;
            
            if (timeInMinutes < minimumBookingTime) {
              const minHour = Math.floor(minimumBookingTime / 60);
              const minMinute = minimumBookingTime % 60;
              alert(`⚠️ For today's bookings, please select a time at least 1 hour from now.\n\nEarliest available: ${String(minHour).padStart(2, '0')}:${String(minMinute).padStart(2, '0')}`);
              this.value = '';
            }
          }
        }
      });
      
      // Also validate time when date changes (for the "today" check)
      if (dateInput) {
        dateInput.addEventListener('change', function() {
          if (timeInput.value) {
            timeInput.dispatchEvent(new Event('change'));
          }
        });
      }
    }
    
    // 3. Add helpful placeholder text
    if (timeInput && !timeInput.placeholder) {
      timeInput.placeholder = '08:00 - 23:30';
    }
    if (dateInput && !dateInput.placeholder) {
      dateInput.placeholder = 'Select date';
    }
  } else {
    console.error('Booking form NOT found - checking all forms on page...');
    const allForms = document.querySelectorAll('form');
    console.log('All forms on page:', allForms);
  }
});