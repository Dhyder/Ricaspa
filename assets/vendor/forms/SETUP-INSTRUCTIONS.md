# Form Handler Setup Guide

## 🎯 Quick Start (3 Steps)

### Step 1: Choose Your Email Service

I've provided **Web3Forms** (easiest, free), but you can also use **EmailJS**. 

---

## Option A: Web3Forms (Recommended - Simplest)

### 1. Get Your Access Key
1. Go to https://web3forms.com
2. Sign up with your email (free)
3. Create a form and get your **Access Key**
4. You can create separate keys for contact and booking forms, or use the same one

### 2. Update the JavaScript
Open `forms-handler.js` and replace:
```javascript
new FormHandler(contactForm, 'YOUR_CONTACT_FORM_ACCESS_KEY');
new FormHandler(bookingForm, 'YOUR_BOOKING_FORM_ACCESS_KEY');
```

With your actual keys:
```javascript
new FormHandler(contactForm, 'abc123-your-actual-key-here');
new FormHandler(bookingForm, 'def456-your-actual-key-here');
```

### 3. Add to Your HTML
In your HTML file, add these before the closing `</body>` tag:

```html
<!-- Add CSS for form styles -->
<link rel="stylesheet" href="forms-styles.css">

<!-- Add JavaScript handler (before closing body tag) -->
<script src="forms-handler.js"></script>
```

### ✅ Done! That's it for Web3Forms.

---

## Option B: EmailJS (More Features)

### 1. Setup EmailJS
1. Go to https://www.emailjs.com
2. Sign up (free tier: 200 emails/month)
3. Add an email service (Gmail, Outlook, etc.)
4. Create two email templates:
   - One for contact form
   - One for booking form

### 2. Get Your Credentials
You'll need:
- **Public Key** (from Account page)
- **Service ID** (from Email Services)
- **Template IDs** (one for each form)

### 3. Update the JavaScript
In `forms-handler.js`, comment out the Web3Forms initialization and uncomment the EmailJS section at the bottom:

```javascript
// Comment out Web3Forms section
/*
document.addEventListener('DOMContentLoaded', function() {
  const contactForm = document.querySelector('form[action*="contact.php"]');
  if (contactForm) {
    new FormHandler(contactForm, 'YOUR_CONTACT_FORM_ACCESS_KEY');
  }
  ...
});
*/

// Uncomment EmailJS section
document.addEventListener('DOMContentLoaded', function() {
  emailjs.init('YOUR_PUBLIC_KEY');
  
  const contactForm = document.querySelector('form[action*="contact.php"]');
  if (contactForm) {
    new FormHandlerEmailJS(contactForm, 'YOUR_SERVICE_ID', 'YOUR_CONTACT_TEMPLATE_ID', 'YOUR_PUBLIC_KEY');
  }

  const bookingForm = document.querySelector('form[action*="book-a-table.php"]');
  if (bookingForm) {
    new FormHandlerEmailJS(bookingForm, 'YOUR_SERVICE_ID', 'YOUR_BOOKING_TEMPLATE_ID', 'YOUR_PUBLIC_KEY');
  }
});
```

### 4. Add EmailJS Library
Add this in your HTML `<head>`:
```html
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
```

---

## 📁 File Structure

Your project should look like this:
```
your-website/
├── index.html (or your main HTML file)
├── forms-handler.js
├── forms-styles.css
├── forms/
│   ├── contact.php (you can delete these now)
│   └── book-a-table.php (you can delete these now)
```

---

## 🔧 Customization Options

### Change Success Messages
In `forms-handler.js`, find the `showSuccess` method and change the text:
```javascript
showSuccess(message) {
  // Change this text
  this.successDiv.textContent = message || 'Your custom success message!';
}
```

### Change Loading/Error Styles
Edit `forms-styles.css` to match your website's colors:
```css
.php-email-form .loading:before {
  border: 3px solid #YOUR_COLOR; /* Change color */
}

.php-email-form .error-message {
  background: #YOUR_ERROR_COLOR;
}

.php-email-form .sent-message {
  background: #YOUR_SUCCESS_COLOR;
}
```

### Add Time Restrictions for Bookings
Already included! The booking form only allows times between 10 AM - 10 PM. 
To change this, edit the time validation in `forms-handler.js`:
```javascript
if (hour < 10 || hour >= 22) { // Change these numbers
  alert('Your custom message');
}
```

---

## 🧪 Testing

1. **Test locally**: Open your HTML file in a browser
2. **Fill out a form** with test data
3. **Submit** and watch for:
   - Loading spinner appears
   - Success or error message
   - Email arrives in your inbox
4. **Check spam folder** if email doesn't arrive

---

## 🐛 Troubleshooting

### Form doesn't submit
- Check browser console (F12) for errors
- Make sure you replaced the access keys
- Verify form has class `php-email-form`

### Email not received
- Check spam folder
- Verify your access key is correct
- Check Web3Forms dashboard for submission logs

### Multiple forms on same page
The script automatically handles both forms - no extra setup needed!

---

## 📊 Comparison

| Feature | Web3Forms | EmailJS |
|---------|-----------|---------|
| Setup Time | 2 minutes | 5 minutes |
| Free Emails | Unlimited | 200/month |
| Custom Templates | No | Yes |
| Email Attachments | No | Yes |
| Best For | Simple forms | Advanced needs |

---

## 🎨 Additional Features You Can Add

### Form Validation Messages
### Honeypot Spam Protection
### Google reCAPTCHA
### Custom Email Templates
### Auto-reply emails

Let me know if you want any of these added!

---

## ✨ What Changed from PHP

**Before (PHP):**
- Required PHP server
- Used proprietary PHP_Email_Form library
- Server-side processing
- Page reload on submit

**After (JavaScript):**
- Works on any hosting (even GitHub Pages!)
- No server required
- Modern AJAX submission
- No page reload
- Better user experience

---

## 💡 Pro Tips

1. **Use the same access key** for both forms to keep it simple
2. **Test in incognito mode** to see how first-time users experience it
3. **Monitor your submission quota** on the service dashboard
4. **Keep your access keys secret** - don't commit them to public repos
5. **Add a phone number field** to booking form for better contact info

---

Need help with setup? Just let me know! 🚀
