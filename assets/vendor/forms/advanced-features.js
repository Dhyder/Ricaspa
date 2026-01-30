// ADVANCED FORM FEATURES
// Add these to enhance your forms

// ==============================================
// 1. FORM VALIDATION WITH REAL-TIME FEEDBACK
// ==============================================

class FormValidator {
  constructor(form) {
    this.form = form;
    this.init();
  }

  init() {
    const inputs = this.form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      input.addEventListener('blur', () => this.validateField(input));
      input.addEventListener('input', () => this.clearError(input));
    });
  }

  validateField(field) {
    const value = field.value.trim();
    const type = field.type;
    let isValid = true;
    let message = '';

    // Required field check
    if (field.hasAttribute('required') && !value) {
      isValid = false;
      message = 'This field is required';
    }
    // Email validation
    else if (type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        isValid = false;
        message = 'Please enter a valid email address';
      }
    }
    // Phone validation
    else if (field.name === 'phone' && value) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(value) || value.length < 10) {
        isValid = false;
        message = 'Please enter a valid phone number';
      }
    }

    if (!isValid) {
      this.showError(field, message);
    } else {
      this.clearError(field);
    }

    return isValid;
  }

  showError(field, message) {
    this.clearError(field);
    field.classList.add('is-invalid');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'invalid-feedback';
    errorDiv.textContent = message;
    field.parentElement.appendChild(errorDiv);
  }

  clearError(field) {
    field.classList.remove('is-invalid');
    const errorDiv = field.parentElement.querySelector('.invalid-feedback');
    if (errorDiv) errorDiv.remove();
  }

  validateAll() {
    const inputs = this.form.querySelectorAll('input[required], textarea[required], select[required]');
    let allValid = true;
    inputs.forEach(input => {
      if (!this.validateField(input)) {
        allValid = false;
      }
    });
    return allValid;
  }
}

// Usage: const validator = new FormValidator(contactForm);

// ==============================================
// 2. AUTO-SAVE FORM DATA (Prevents data loss)
// ==============================================

class FormAutoSave {
  constructor(form, storageKey) {
    this.form = form;
    this.storageKey = storageKey;
    this.init();
  }

  init() {
    // Load saved data
    this.loadData();

    // Save on input
    this.form.addEventListener('input', () => this.saveData());

    // Clear on successful submit
    this.form.addEventListener('submit', () => {
      setTimeout(() => this.clearData(), 2000);
    });
  }

  saveData() {
    const formData = new FormData(this.form);
    const data = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  loadData() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      const data = JSON.parse(saved);
      Object.keys(data).forEach(key => {
        const field = this.form.querySelector(`[name="${key}"]`);
        if (field && data[key]) {
          field.value = data[key];
        }
      });
    }
  }

  clearData() {
    localStorage.removeItem(this.storageKey);
  }
}

// Usage: new FormAutoSave(contactForm, 'contact-form-data');

// ==============================================
// 3. CHARACTER COUNTER FOR TEXTAREAS
// ==============================================

class CharacterCounter {
  constructor(textarea, maxLength = 500) {
    this.textarea = textarea;
    this.maxLength = maxLength;
    this.init();
  }

  init() {
    this.textarea.setAttribute('maxlength', this.maxLength);
    
    const counter = document.createElement('div');
    counter.className = 'character-counter';
    counter.style.cssText = 'text-align: right; font-size: 12px; color: #666; margin-top: 5px;';
    this.textarea.parentElement.appendChild(counter);
    
    this.updateCounter(counter);
    this.textarea.addEventListener('input', () => this.updateCounter(counter));
  }

  updateCounter(counter) {
    const remaining = this.maxLength - this.textarea.value.length;
    counter.textContent = `${remaining} characters remaining`;
    counter.style.color = remaining < 50 ? '#dc3545' : '#666';
  }
}

// Usage: new CharacterCounter(document.querySelector('textarea[name="message"]'));

// ==============================================
// 4. SMART DATE PICKER (Business days only)
// ==============================================

class BusinessDayPicker {
  constructor(dateInput, options = {}) {
    this.dateInput = dateInput;
    this.excludeWeekends = options.excludeWeekends !== false;
    this.excludeDates = options.excludeDates || []; // ['2024-12-25', '2024-01-01']
    this.minDaysAhead = options.minDaysAhead || 1;
    this.init();
  }

  init() {
    // Set minimum date
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + this.minDaysAhead);
    this.dateInput.setAttribute('min', this.formatDate(minDate));

    // Validate on change
    this.dateInput.addEventListener('change', () => this.validate());
  }

  validate() {
    const selectedDate = new Date(this.dateInput.value);
    
    // Check if weekend
    if (this.excludeWeekends) {
      const day = selectedDate.getDay();
      if (day === 0 || day === 6) {
        alert('Please select a weekday (Monday-Friday)');
        this.dateInput.value = '';
        return false;
      }
    }

    // Check if excluded date
    const dateStr = this.formatDate(selectedDate);
    if (this.excludeDates.includes(dateStr)) {
      alert('This date is not available. Please select another date.');
      this.dateInput.value = '';
      return false;
    }

    return true;
  }

  formatDate(date) {
    return date.toISOString().split('T')[0];
  }
}

// Usage:
// new BusinessDayPicker(document.querySelector('input[name="date"]'), {
//   excludeWeekends: true,
//   excludeDates: ['2024-12-25', '2024-12-26'], // holidays
//   minDaysAhead: 2
// });

// ==============================================
// 5. CONFIRMATION MODAL BEFORE SUBMIT
// ==============================================

class ConfirmationModal {
  constructor(form, options = {}) {
    this.form = form;
    this.title = options.title || 'Confirm Submission';
    this.message = options.message || 'Are you sure you want to submit this form?';
    this.init();
  }

  init() {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.show(e);
    });
  }

  show(originalEvent) {
    const modal = document.createElement('div');
    modal.className = 'confirmation-modal';
    modal.innerHTML = `
      <div class="modal-overlay" style="
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); display: flex; align-items: center;
        justify-content: center; z-index: 9999;">
        <div class="modal-content" style="
          background: white; padding: 30px; border-radius: 10px;
          max-width: 400px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
          <h3 style="margin-bottom: 15px;">${this.title}</h3>
          <p style="margin-bottom: 25px; color: #666;">${this.message}</p>
          <button class="confirm-btn" style="
            background: #059652; color: white; border: none;
            padding: 10px 30px; border-radius: 5px; cursor: pointer;
            margin-right: 10px; font-size: 16px;">Confirm</button>
          <button class="cancel-btn" style="
            background: #dc3545; color: white; border: none;
            padding: 10px 30px; border-radius: 5px; cursor: pointer;
            font-size: 16px;">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.confirm-btn').addEventListener('click', () => {
      modal.remove();
      this.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: false }));
    });

    modal.querySelector('.cancel-btn').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        modal.remove();
      }
    });
  }
}

// Usage: new ConfirmationModal(bookingForm, {
//   title: 'Confirm Booking',
//   message: 'Please confirm your booking details are correct.'
// });

// ==============================================
// 6. FORM ANALYTICS (Track interactions)
// ==============================================

class FormAnalytics {
  constructor(form) {
    this.form = form;
    this.startTime = null;
    this.fieldInteractions = {};
    this.init();
  }

  init() {
    // Track form start
    this.form.addEventListener('focus', () => {
      if (!this.startTime) {
        this.startTime = Date.now();
        this.track('form_started');
      }
    }, true);

    // Track field interactions
    const fields = this.form.querySelectorAll('input, textarea, select');
    fields.forEach(field => {
      field.addEventListener('focus', () => {
        this.fieldInteractions[field.name] = (this.fieldInteractions[field.name] || 0) + 1;
      });
    });

    // Track submission
    this.form.addEventListener('submit', () => {
      const timeSpent = Math.round((Date.now() - this.startTime) / 1000);
      this.track('form_submitted', { 
        timeSpent,
        interactions: this.fieldInteractions 
      });
    });
  }

  track(event, data = {}) {
    console.log('📊 Analytics:', event, data);
    // Send to your analytics service (Google Analytics, Mixpanel, etc.)
    // gtag('event', event, data);
  }
}

// Usage: new FormAnalytics(contactForm);

// ==============================================
// 7. MULTI-STEP FORM (If you want to split forms)
// ==============================================

class MultiStepForm {
  constructor(form) {
    this.form = form;
    this.steps = form.querySelectorAll('.form-step');
    this.currentStep = 0;
    this.init();
  }

  init() {
    this.showStep(0);
    this.addNavigation();
  }

  showStep(index) {
    this.steps.forEach((step, i) => {
      step.style.display = i === index ? 'block' : 'none';
    });
    this.currentStep = index;
  }

  addNavigation() {
    const nav = document.createElement('div');
    nav.className = 'form-navigation';
    nav.innerHTML = `
      <button type="button" class="prev-btn">Previous</button>
      <button type="button" class="next-btn">Next</button>
    `;
    this.form.appendChild(nav);

    nav.querySelector('.prev-btn').addEventListener('click', () => this.prevStep());
    nav.querySelector('.next-btn').addEventListener('click', () => this.nextStep());

    this.updateNav();
  }

  nextStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.showStep(this.currentStep + 1);
      this.updateNav();
    }
  }

  prevStep() {
    if (this.currentStep > 0) {
      this.showStep(this.currentStep - 1);
      this.updateNav();
    }
  }

  updateNav() {
    const prevBtn = this.form.querySelector('.prev-btn');
    const nextBtn = this.form.querySelector('.next-btn');
    
    prevBtn.style.display = this.currentStep === 0 ? 'none' : 'inline-block';
    nextBtn.style.display = this.currentStep === this.steps.length - 1 ? 'none' : 'inline-block';
  }
}

// ==============================================
// COMBINE ALL FEATURES - ENHANCED FORM HANDLER
// ==============================================

class EnhancedFormHandler {
  constructor(formElement, accessKey, options = {}) {
    this.form = formElement;
    this.accessKey = accessKey;
    this.options = options;
    
    // Initialize all features
    if (options.validation) new FormValidator(formElement);
    if (options.autoSave) new FormAutoSave(formElement, options.storageKey);
    if (options.analytics) new FormAnalytics(formElement);
    if (options.confirmation) new ConfirmationModal(formElement, options.confirmationOptions);
    
    // Add character counter to textareas
    if (options.characterCounter) {
      formElement.querySelectorAll('textarea').forEach(textarea => {
        new CharacterCounter(textarea, options.maxLength);
      });
    }
    
    // Set up date picker restrictions
    if (options.businessDaysOnly) {
      const dateInput = formElement.querySelector('input[type="date"]');
      if (dateInput) {
        new BusinessDayPicker(dateInput, options.dateOptions);
      }
    }
    
    // Original form submission
    new FormHandler(formElement, accessKey);
  }
}

// USAGE EXAMPLE - All features enabled:
/*
document.addEventListener('DOMContentLoaded', function() {
  const bookingForm = document.querySelector('form[action*="book-a-table.php"]');
  
  if (bookingForm) {
    new EnhancedFormHandler(bookingForm, 'YOUR_ACCESS_KEY', {
      validation: true,
      autoSave: true,
      storageKey: 'booking-form-backup',
      analytics: true,
      confirmation: true,
      confirmationOptions: {
        title: 'Confirm Your Booking',
        message: 'Please review your booking details before submitting.'
      },
      characterCounter: true,
      maxLength: 500,
      businessDaysOnly: true,
      dateOptions: {
        excludeWeekends: true,
        excludeDates: ['2024-12-25', '2024-12-26'],
        minDaysAhead: 2
      }
    });
  }
});
*/

// Export for use
export {
  FormValidator,
  FormAutoSave,
  CharacterCounter,
  BusinessDayPicker,
  ConfirmationModal,
  FormAnalytics,
  MultiStepForm,
  EnhancedFormHandler
};
