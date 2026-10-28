const express = require('express');
const router = express.Router();

const ALLOWED_SERVICES = [
  'Vulnerability Assessment',
  'Penetration Testing',
  'Security Awareness Training',
  'Compliance & Policy Review (ISO 27001)',
  'Not sure yet'
];

const ALLOWED_SLOTS = [
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '12:00 PM',
  '12:30 PM',
  '01:00 PM',
  '01:30 PM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
  '04:30 PM',
  '05:00 PM'
];

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

// Helper: Get today's date in Asia/Dubai (YYYY-MM-DD)
function getDubaiTodayString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}

// Helper: Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email) && email.length <= 100;
}

// Helper: Validate booking submission
function validateBooking(body) {
  const errors = [];
  const service = typeof body.service === 'string' ? body.service.trim() : '';
  const date = typeof body.date === 'string' ? body.date.trim() : '';
  const timeSlot = typeof body.timeSlot === 'string' ? body.timeSlot.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const company = typeof body.company === 'string' ? body.company.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  // Service validation
  if (!service || !ALLOWED_SERVICES.includes(service)) {
    errors.push('Please select a valid service option or choose "Not sure yet".');
  }

  // Date validation (Asia/Dubai, Monday–Friday only, no past dates)
  const todayDubai = getDubaiTodayString();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!date || !dateRegex.test(date)) {
    errors.push('Please provide a valid date in YYYY-MM-DD format.');
  } else if (date < todayDubai) {
    errors.push('Past dates are not allowed. Please choose today or a future date.');
  } else {
    // Check day of week (Monday–Friday only: 1 to 5)
    const dateObj = new Date(`${date}T12:00:00+04:00`);
    const dayOfWeek = dateObj.getDay(); // 0: Sun, 6: Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      errors.push('Bookings are available Monday to Friday only (Asia/Dubai time zone).');
    }
  }

  // Time slot validation
  if (!timeSlot || !ALLOWED_SLOTS.includes(timeSlot)) {
    errors.push('Please select an available 30-minute time slot between 10:00 AM and 5:00 PM.');
  }

  // Name validation
  if (!name || name.length < 2 || name.length > 100) {
    errors.push('Name must be between 2 and 100 characters.');
  }

  // Company validation (optional)
  if (company && company.length > 100) {
    errors.push('Company name cannot exceed 100 characters.');
  }

  // Phone validation
  const phoneClean = phone.replace(/[\s\-\(\)\.]/g, '');
  if (!phone || phoneClean.length < 7 || phone.length > 30) {
    errors.push('Please provide a valid phone number (between 7 and 30 characters).');
  }

  // Email validation
  if (!isValidEmail(email)) {
    errors.push('Please provide a valid email address.');
  }

  // Message validation
  if (!message || message.length < 5 || message.length > 1000) {
    errors.push('Please enter a short message describing what you need (5 to 1000 characters).');
  }

  const sanitized = {
    service: escapeHtml(service),
    date: escapeHtml(date),
    timeSlot: escapeHtml(timeSlot),
    name: escapeHtml(name),
    company: escapeHtml(company),
    phone: escapeHtml(phone),
    email: escapeHtml(email),
    message: escapeHtml(message),
    timeZone: 'Asia/Dubai (GST, UTC+4)'
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
}

const appointmentService = require('../services/appointmentService');

// GET /booking/booked-slots - Return booked slots for dynamic UI disabling
router.get('/booked-slots', (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date.trim() : '';
  if (!date) return res.json({ bookedSlots: [] });
  try {
    const bookings = appointmentService.getBookingsByDate(date);
    const bookedSlots = bookings
      .filter(b => b.status !== 'Cancelled')
      .map(b => {
        const parts = b.bookingDateTime.split(' ');
        return parts.slice(1).join(' ');
      });
    res.json({ bookedSlots });
  } catch (err) {
    res.json({ bookedSlots: [] });
  }
});

// GET /booking - Display booking wizard
router.get('/', (req, res) => {
  res.render('booking', {
    pageTitle: 'Book a Free Discovery Call | Usman Naeem Cyber Security',
    brandName: 'Usman Naeem Cyber Security Consulting',
    consultantName: 'Usman Naeem',
    services: ALLOWED_SERVICES,
    timeSlots: ALLOWED_SLOTS,
    minDate: getDubaiTodayString(),
    timeZone: 'Asia/Dubai',
    errors: [],
    formData: {
      service: req.query.service || '',
      date: '',
      timeSlot: '',
      name: '',
      company: '',
      phone: '',
      email: '',
      message: ''
    },
    confirmed: false,
    summary: null
  });
});

// POST /booking - Validate & save booking via appointmentService
router.post('/', (req, res) => {
  const result = validateBooking(req.body);

  if (!result.isValid) {
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(400).json({ success: false, errors: result.errors });
    }

    return res.status(400).render('booking', {
      pageTitle: 'Book a Free Discovery Call | Usman Naeem Cyber Security',
      brandName: 'Usman Naeem Cyber Security Consulting',
      consultantName: 'Usman Naeem',
      services: ALLOWED_SERVICES,
      timeSlots: ALLOWED_SLOTS,
      minDate: getDubaiTodayString(),
      timeZone: 'Asia/Dubai',
      errors: result.errors,
      formData: {
        service: req.body.service || '',
        date: req.body.date || '',
        timeSlot: req.body.timeSlot || '',
        name: req.body.name || '',
        company: req.body.company || '',
        phone: req.body.phone || '',
        email: req.body.email || '',
        message: req.body.message || ''
      },
      confirmed: false,
      summary: null
    });
  }

  // Persist booking through appointmentService (checks double booking automatically)
  const bookingDateTime = `${result.sanitized.date} ${result.sanitized.timeSlot}`;
  let savedBooking;
  try {
    savedBooking = appointmentService.createBooking({
      service: result.sanitized.service,
      bookingDateTime: bookingDateTime,
      clientName: result.sanitized.name,
      clientCompany: result.sanitized.company,
      clientPhone: result.sanitized.phone,
      clientEmail: result.sanitized.email,
      message: result.sanitized.message,
      status: 'Booked'
    });
  } catch (err) {
    const errorMsg = err.code === 'DOUBLE_BOOKING'
      ? err.message
      : (err.message || 'An error occurred while saving the booking.');

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(400).json({ success: false, errors: [errorMsg] });
    }

    return res.status(400).render('booking', {
      pageTitle: 'Book a Free Discovery Call | Usman Naeem Cyber Security',
      brandName: 'Usman Naeem Cyber Security Consulting',
      consultantName: 'Usman Naeem',
      services: ALLOWED_SERVICES,
      timeSlots: ALLOWED_SLOTS,
      minDate: getDubaiTodayString(),
      timeZone: 'Asia/Dubai',
      errors: [errorMsg],
      formData: {
        service: req.body.service || '',
        date: req.body.date || '',
        timeSlot: req.body.timeSlot || '',
        name: req.body.name || '',
        company: req.body.company || '',
        phone: req.body.phone || '',
        email: req.body.email || '',
        message: req.body.message || ''
      },
      confirmed: false,
      summary: null
    });
  }

  // Render confirmation screen with saved booking details
  const confirmedSummary = {
    ...result.sanitized,
    id: savedBooking.id,
    status: savedBooking.status,
    createdAt: savedBooking.createdAt
  };

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({
      success: true,
      message: 'Booking saved and confirmed successfully!',
      summary: confirmedSummary,
      booking: savedBooking
    });
  }

  res.render('booking', {
    pageTitle: 'Discovery Call Confirmed | Usman Naeem Cyber Security',
    brandName: 'Usman Naeem Cyber Security Consulting',
    consultantName: 'Usman Naeem',
    services: ALLOWED_SERVICES,
    timeSlots: ALLOWED_SLOTS,
    minDate: getDubaiTodayString(),
    timeZone: 'Asia/Dubai',
    errors: [],
    formData: {},
    confirmed: true,
    summary: confirmedSummary
  });
});

module.exports = router;
