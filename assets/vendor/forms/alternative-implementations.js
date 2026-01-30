// ALTERNATIVE IMPLEMENTATIONS
// Choose one based on your backend preference

// ==============================================
// 1. FORMSPREE (Simplest - Just change form action)
// ==============================================
/*
Just change your form action attribute to:
<form action="https://formspree.io/f/YOUR_FORM_ID" method="POST" class="php-email-form">

No JavaScript needed! But if you want AJAX + loading states, use this:
*/

class FormspreeHandler {
  constructor(formElement, formspreeEndpoint) {
    this.form = formElement;
    this.endpoint = formspreeEndpoint;
    this.loadingDiv = formElement.querySelector('.loading');
    this.errorDiv = formElement.querySelector('.error-message');
    this.successDiv = formElement.querySelector('.sent-message');
    this.submitBtn = formElement.querySelector('button[type="submit"]');
    
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  async handleSubmit(e) {
    e.preventDefault();
    this.loadingDiv.style.display = 'block';
    this.errorDiv.style.display = 'none';
    this.successDiv.style.display = 'none';
    this.submitBtn.disabled = true;

    const formData = new FormData(this.form);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        this.loadingDiv.style.display = 'none';
        this.successDiv.style.display = 'block';
        this.form.reset();
        setTimeout(() => this.successDiv.style.display = 'none', 5000);
      } else {
        throw new Error('Form submission failed');
      }
    } catch (error) {
      this.loadingDiv.style.display = 'none';
      this.errorDiv.style.display = 'block';
      this.errorDiv.textContent = 'Something went wrong. Please try again.';
    }
    
    this.submitBtn.disabled = false;
  }
}

// Usage:
// new FormspreeHandler(contactForm, 'https://formspree.io/f/YOUR_FORM_ID');

// ==============================================
// 2. YOUR OWN BACKEND API (Node.js/Express example)
// ==============================================
/*
If you want to build your own backend, here's the JavaScript for the frontend:
*/

class CustomBackendHandler {
  constructor(formElement, apiEndpoint) {
    this.form = formElement;
    this.apiEndpoint = apiEndpoint;
    this.loadingDiv = formElement.querySelector('.loading');
    this.errorDiv = formElement.querySelector('.error-message');
    this.successDiv = formElement.querySelector('.sent-message');
    this.submitBtn = formElement.querySelector('button[type="submit"]');
    
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  async handleSubmit(e) {
    e.preventDefault();
    this.loadingDiv.style.display = 'block';
    this.errorDiv.style.display = 'none';
    this.successDiv.style.display = 'none';
    this.submitBtn.disabled = true;

    const formData = new FormData(this.form);
    const data = Object.fromEntries(formData);

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        this.loadingDiv.style.display = 'none';
        this.successDiv.style.display = 'block';
        this.successDiv.textContent = result.message || 'Success!';
        this.form.reset();
        setTimeout(() => this.successDiv.style.display = 'none', 5000);
      } else {
        throw new Error(result.message || 'Submission failed');
      }
    } catch (error) {
      this.loadingDiv.style.display = 'none';
      this.errorDiv.style.display = 'block';
      this.errorDiv.textContent = error.message;
    }
    
    this.submitBtn.disabled = false;
  }
}

// Usage:
// new CustomBackendHandler(contactForm, '/api/contact');
// new CustomBackendHandler(bookingForm, '/api/booking');

// ==============================================
// 3. BACKEND EXAMPLE (Node.js + Nodemailer)
// ==============================================
/*
// File: server.js
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
});

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;

  const mailOptions = {
    from: email,
    to: 'your-email@gmail.com',
    subject: `Contact Form: ${subject}`,
    html: `
      <h3>New Contact Form Submission</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// Booking form endpoint
app.post('/api/booking', async (req, res) => {
  const { name, email, phone, people, date, time, message } = req.body;

  const mailOptions = {
    from: email,
    to: 'your-email@gmail.com',
    subject: `New Table Booking Request`,
    html: `
      <h3>New Booking Request</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>People:</strong> ${people}</p>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Time:</strong> ${time}</p>
      <p><strong>Special Requests:</strong></p>
      <p>${message || 'None'}</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Booking request received!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to process booking' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
*/

// ==============================================
// 4. NETLIFY FORMS (If hosted on Netlify)
// ==============================================
/*
If you're hosting on Netlify, just add these attributes to your form:

<form name="contact" method="POST" data-netlify="true" class="php-email-form">
  <input type="hidden" name="form-name" value="contact" />
  <!-- rest of form fields -->
</form>

For AJAX submission with Netlify:
*/

class NetlifyFormHandler {
  constructor(formElement) {
    this.form = formElement;
    this.loadingDiv = formElement.querySelector('.loading');
    this.errorDiv = formElement.querySelector('.error-message');
    this.successDiv = formElement.querySelector('.sent-message');
    this.submitBtn = formElement.querySelector('button[type="submit"]');
    
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  async handleSubmit(e) {
    e.preventDefault();
    this.loadingDiv.style.display = 'block';
    this.errorDiv.style.display = 'none';
    this.successDiv.style.display = 'none';
    this.submitBtn.disabled = true;

    const formData = new FormData(this.form);

    try {
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString()
      });

      if (response.ok) {
        this.loadingDiv.style.display = 'none';
        this.successDiv.style.display = 'block';
        this.form.reset();
        setTimeout(() => this.successDiv.style.display = 'none', 5000);
      } else {
        throw new Error('Submission failed');
      }
    } catch (error) {
      this.loadingDiv.style.display = 'none';
      this.errorDiv.style.display = 'block';
      this.errorDiv.textContent = 'Something went wrong. Please try again.';
    }
    
    this.submitBtn.disabled = false;
  }
}

// ==============================================
// 5. SPAM PROTECTION - Honeypot Method
// ==============================================
/*
Add this hidden field to your forms to catch bots:

<input type="text" name="honeypot" style="display: none;" tabindex="-1" autocomplete="off">

Then in your form handler, check if it's filled:
*/

function checkHoneypot(formData) {
  const honeypot = formData.get('honeypot');
  if (honeypot) {
    // It's a bot, reject silently
    return false;
  }
  return true;
}

// ==============================================
// 6. GOOGLE reCAPTCHA Integration
// ==============================================
/*
1. Get reCAPTCHA keys from https://www.google.com/recaptcha/admin
2. Add to HTML before closing </body>:
   <script src="https://www.google.com/recaptcha/api.js" async defer></script>
3. Add to form:
   <div class="g-recaptcha" data-sitekey="YOUR_SITE_KEY"></div>
4. Verify in your handler:
*/

async function verifyCaptcha(token) {
  const response = await fetch('/api/verify-captcha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  return response.json();
}

// ==============================================
// 7. SAVE TO DATABASE (If you have backend)
// ==============================================
/*
Frontend remains the same, but backend saves to database:

// Backend example with MongoDB
app.post('/api/booking', async (req, res) => {
  const booking = new Booking(req.body);
  await booking.save();
  
  // Also send email
  await sendEmail(req.body);
  
  res.json({ success: true });
});
*/

// ==============================================
// COMPARISON TABLE
// ==============================================
/*
| Service       | Pros                          | Cons                    | Cost      |
|---------------|-------------------------------|-------------------------|-----------|
| Web3Forms     | Easiest, unlimited emails     | Basic features          | Free      |
| EmailJS       | Custom templates, 200/mo      | Monthly limit           | Free tier |
| Formspree     | Dead simple, good free tier   | 50 submissions/mo free  | $10/mo+   |
| Custom Backend| Full control, unlimited       | Requires server         | Varies    |
| Netlify Forms | Auto-setup if on Netlify      | 100 submissions/mo free | Free tier |
| Vercel        | Serverless functions included | Need to code functions  | Free tier |
*/

export {
  FormspreeHandler,
  CustomBackendHandler,
  NetlifyFormHandler,
  checkHoneypot,
  verifyCaptcha
};
