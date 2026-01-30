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
      this.successDiv.style.display = 'block';
      // Make sure we're only showing the message, not the whole object
      if (typeof message === 'object') {
        this.successDiv.textContent = message.message || 'Your message has been sent successfully!';
      } else if (message) {
        this.successDiv.textContent = message;
      }
      // Keep original text if no message provided
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
  
  // Contact Form
  const contactForm = document.querySelector('form[action*="contact.php"]');
  if (contactForm) {
    new MinimalFormHandler(contactForm, '10be60a7-1a71-4b3a-be3a-834e48e9508e');
  }

  // Booking Form  vm
  const bookingForm = document.querySelector('form[action*="book-a-table.php"]');
  if (bookingForm) {
    new MinimalFormHandler(bookingForm, '933028d5-9b33-4467-abd1-44c2ebbe831f');
  }

  // Optional: Add date restrictions for booking form
  if (bookingForm) {
    const dateInput = bookingForm.querySelector('input[name="date"]');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.setAttribute('min', today);
    }
  }
});