const express = require('express');
const router = express.Router();

// Helper: Escape HTML strings to prevent XSS
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper: Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email) && email.length <= 100;
}

// Helper: Validate contact submission
function validateContact(body) {
  const errors = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const company = typeof body.company === 'string' ? body.company.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const honeypot = typeof body.website === 'string' ? body.website.trim() : '';

  // Honeypot check: If the hidden field has any content, it was filled by an automated bot
  if (honeypot !== '') {
    return {
      isBot: true,
      isValid: false,
      errors: ['Spam detected. Submission ignored.'],
      sanitized: null
    };
  }

  // Name validation
  if (!name || name.length < 2 || name.length > 100) {
    errors.push('Name must be between 2 and 100 characters.');
  }

  // Email validation
  if (!isValidEmail(email)) {
    errors.push('Please provide a valid email address.');
  }

  // Company validation (optional)
  if (company && company.length > 100) {
    errors.push('Company name cannot exceed 100 characters.');
  }

  // Message validation
  if (!message || message.length < 5 || message.length > 1000) {
    errors.push('Message must be between 5 and 1000 characters.');
  }

  const sanitized = {
    name: escapeHtml(name),
    email: escapeHtml(email),
    company: escapeHtml(company),
    message: escapeHtml(message)
  };

  return {
    isBot: false,
    isValid: errors.length === 0,
    errors,
    sanitized
  };
}

// GET /contact - Contact form page
router.get('/', (req, res) => {
  res.render('contact', {
    pageTitle: 'Contact | Usman Naeem Cyber Security Consulting Dubai',
    brandName: 'Usman Naeem Cyber Security Consulting',
    consultantName: 'Usman Naeem',
    email: 'usman@usmancybersecurity.com',
    phone: '+971 4 234 5678',
    location: 'Dubai, UAE · Remote Worldwide',
    availability: 'Mon–Fri 9am–6pm GST',
    errors: [],
    successMessage: null,
    formData: {
      name: '',
      email: '',
      company: '',
      message: ''
    }
  });
});

const appointmentService = require('../services/appointmentService');

// POST /contact - Process contact submission with honeypot and validation
router.post('/', (req, res) => {
  const result = validateContact(req.body);

  // If honeypot caught a bot, silently return fake success to avoid giving clues to spam scripts
  if (result.isBot) {
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ success: true, message: 'Thank you for reaching out.' });
    }
    return res.render('contact', {
      pageTitle: 'Contact | Usman Naeem Cyber Security Consulting Dubai',
      brandName: 'Usman Naeem Cyber Security Consulting',
      consultantName: 'Usman Naeem',
      email: 'usman@usmancybersecurity.com',
      phone: '+971 4 234 5678',
      location: 'Dubai, UAE · Remote Worldwide',
      availability: 'Mon–Fri 9am–6pm GST',
      errors: [],
      successMessage: 'Thank you! Your inquiry has been received.',
      formData: {}
    });
  }

  if (!result.isValid) {
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(400).json({ success: false, errors: result.errors });
    }

    return res.status(400).render('contact', {
      pageTitle: 'Contact | Usman Naeem Cyber Security Consulting Dubai',
      brandName: 'Usman Naeem Cyber Security Consulting',
      consultantName: 'Usman Naeem',
      email: 'usman@usmancybersecurity.com',
      phone: '+971 4 234 5678',
      location: 'Dubai, UAE · Remote Worldwide',
      availability: 'Mon–Fri 9am–6pm GST',
      errors: result.errors,
      successMessage: null,
      formData: {
        name: req.body.name || '',
        email: req.body.email || '',
        company: req.body.company || '',
        message: req.body.message || ''
      }
    });
  }

  // Persist enquiry in SQLite database using appointmentService
  let savedEnquiry = null;
  try {
    savedEnquiry = appointmentService.createEnquiry({
      name: result.sanitized.name,
      email: result.sanitized.email,
      company: result.sanitized.company,
      message: result.sanitized.message
    });
  } catch (err) {
    console.error('Error saving enquiry:', err);
  }

  const successMsg = `Thank you, ${result.sanitized.name}! Your message has been received. Usman Naeem will reply within 24 business hours.`;

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({
      success: true,
      message: successMsg,
      data: result.sanitized,
      enquiryId: savedEnquiry ? savedEnquiry.id : null
    });
  }

  res.render('contact', {
    pageTitle: 'Message Received | Usman Naeem Cyber Security Consulting Dubai',
    brandName: 'Usman Naeem Cyber Security Consulting',
    consultantName: 'Usman Naeem',
    email: 'usman@usmancybersecurity.com',
    phone: '+971 4 234 5678',
    location: 'Dubai, UAE · Remote Worldwide',
    availability: 'Mon–Fri 9am–6pm GST',
    errors: [],
    successMessage: successMsg,
    formData: {}
  });
});

module.exports = router;
