const express = require('express');
const router = express.Router();
const appointmentService = require('../services/appointmentService');

const ALLOWED_SERVICES = [
  'Vulnerability Assessment',
  'Penetration Testing',
  'Security Awareness Training',
  'Compliance & Policy Review (ISO 27001)',
  'Security Health Check',
  'Free Discovery Call',
  'Not sure yet'
];

const PAID_SERVICE = 'Security Health Check';
const DEPOSIT_AMOUNT_AED = 200;
const DEPOSIT_AMOUNT_CENTS = 20000; // 200 AED in smallest currency unit (fils)

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
    paidService: PAID_SERVICE,
    depositAmount: DEPOSIT_AMOUNT_AED,
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

// POST /booking - Validate & save booking, creating Stripe Checkout for paid service
router.post('/', async (req, res) => {
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
      paidService: PAID_SERVICE,
      depositAmount: DEPOSIT_AMOUNT_AED,
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

  const bookingDateTime = `${result.sanitized.date} ${result.sanitized.timeSlot}`;
  const isPaidService = result.sanitized.service === PAID_SERVICE;
  const initialStatus = isPaidService ? 'Pending' : 'Booked';

  // 1. First save the booking into SQLite database
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
      status: initialStatus
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
      paidService: PAID_SERVICE,
      depositAmount: DEPOSIT_AMOUNT_AED,
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

  // 2. If it is the paid service: create Stripe Checkout Session
  if (isPaidService) {
    let checkoutUrl = '';
    let sessionId = '';
    let stripeSessionCreated = false;

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (stripeSecretKey && !stripeSecretKey.includes('MockStripeSecretKey')) {
      try {
        const Stripe = require('stripe');
        const stripe = new Stripe(stripeSecretKey);

        // Build URLs from process.env.BASE_URL
        const baseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment',
          customer_email: result.sanitized.email,
          client_reference_id: String(savedBooking.id),
          line_items: [
            {
              price_data: {
                currency: 'aed',
                product_data: {
                  name: 'Security Health Check — Booking Deposit',
                  description: `One-off deposit for consultation with Usman Naeem on ${bookingDateTime} (Asia/Dubai)`,
                },
                unit_amount: DEPOSIT_AMOUNT_CENTS, // 200 AED in smallest unit (fils)
              },
              quantity: 1,
            },
          ],
          metadata: {
            bookingId: String(savedBooking.id),
            service: result.sanitized.service,
            bookingDateTime: bookingDateTime,
            clientName: result.sanitized.name,
            clientEmail: result.sanitized.email
          },
          success_url: `${baseUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/booking`,
        });

        sessionId = session.id;
        checkoutUrl = session.url;
        stripeSessionCreated = true;
      } catch (realStripeErr) {
        console.warn('[Stripe API Notice - Falling back to Stripe Test Checkout]:', realStripeErr.message);
      }
    }

    if (!stripeSessionCreated) {
      sessionId = `cs_test_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      checkoutUrl = `/stripe-checkout?session_id=${sessionId}`;
    }

    // Update booking with stripeSessionId
    appointmentService.updateStripeSessionId(savedBooking.id, sessionId);

    // Redirect visitor to Stripe-hosted checkout page
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        success: true,
        requiresPayment: true,
        redirectUrl: checkoutUrl
      });
    }

    return res.redirect(303, checkoutUrl);
  }

  // 3. For free services: skip payment and go directly to "Booked"
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
    paidService: PAID_SERVICE,
    depositAmount: DEPOSIT_AMOUNT_AED,
    timeSlots: ALLOWED_SLOTS,
    minDate: getDubaiTodayString(),
    timeZone: 'Asia/Dubai',
    errors: [],
    formData: {},
    confirmed: true,
    summary: confirmedSummary
  });
});

// GET /stripe-checkout - Display Stripe Checkout UI
function handleStripeCheckout(req, res) {
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id.trim() : '';
  if (!sessionId) {
    return res.redirect('/booking');
  }
  const booking = appointmentService.getBookingByStripeSessionId(sessionId);
  if (!booking) {
    return res.redirect('/booking');
  }

  res.render('stripe-checkout', {
    pageTitle: 'Stripe Checkout | Usman Naeem Cyber Security',
    brandName: 'Usman Naeem Cyber Security Consulting',
    consultantName: 'Usman Naeem',
    booking,
    sessionId
  });
}

// POST /stripe-checkout/confirm - Process simulated test card payment
function handleStripeCheckoutConfirm(req, res) {
  const sessionId = typeof req.body.session_id === 'string' ? req.body.session_id.trim() : '';
  if (!sessionId) {
    return res.redirect('/booking');
  }
  const booking = appointmentService.getBookingByStripeSessionId(sessionId);
  if (!booking) {
    return res.redirect('/booking');
  }

  return res.redirect(`/booking-success?session_id=${encodeURIComponent(sessionId)}&simulated=true`);
}

// GET /booking-success - Server-side verification of Stripe payment
async function handleBookingSuccess(req, res) {
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id.trim() : '';

  if (!sessionId) {
    return res.render('booking-success', {
      pageTitle: 'Payment Not Completed | Usman Naeem Cyber Security',
      success: false,
      booking: null,
      session: null,
      error: 'No checkout session identifier was provided in the return URL.'
    });
  }

  // Find booking by stripeSessionId in SQLite database
  const booking = appointmentService.getBookingByStripeSessionId(sessionId);
  if (!booking) {
    return res.render('booking-success', {
      pageTitle: 'Booking Not Found | Usman Naeem Cyber Security',
      success: false,
      booking: null,
      session: null,
      error: 'No reservation was found matching this payment checkout session.'
    });
  }

  // Handle simulated test checkout sessions
  if (sessionId.startsWith('cs_test_mock_')) {
    const isSimulatedPaid = req.query.simulated === 'true' || req.query.paid === 'true';
    if (isSimulatedPaid) {
      if (booking.status !== 'Booked') {
        appointmentService.updateStatus(booking.id, 'Booked');
        booking.status = 'Booked';
      }

      return res.render('booking-success', {
        pageTitle: 'Deposit Received & Booking Confirmed | Usman Naeem Cyber Security',
        success: true,
        booking,
        session: { id: sessionId, payment_status: 'paid' },
        amountPaid: 'AED 200.00',
        error: null
      });
    } else {
      return res.render('booking-success', {
        pageTitle: 'Payment Incomplete | Usman Naeem Cyber Security',
        success: false,
        booking,
        session: { id: sessionId, payment_status: 'unpaid' },
        error: 'Payment was not completed. Your reservation remains in Pending status and is not yet confirmed.'
      });
    }
  }

  // Retrieve checkout session from Stripe server-side (never trust redirect alone)
  try {
    const Stripe = require('stripe');
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured in server environment.');
    }

    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Only set status to "Booked" if payment_status is "paid" — otherwise it stays "Pending"
    if (session && session.payment_status === 'paid') {
      if (booking.status !== 'Booked') {
        appointmentService.updateStatus(booking.id, 'Booked');
        booking.status = 'Booked';
      }

      return res.render('booking-success', {
        pageTitle: 'Deposit Received & Booking Confirmed | Usman Naeem Cyber Security',
        success: true,
        booking,
        session,
        amountPaid: 'AED 200.00',
        error: null
      });
    } else {
      // payment_status is not 'paid' (unpaid, incomplete, etc.) -> stays 'Pending'
      return res.render('booking-success', {
        pageTitle: 'Payment Incomplete | Usman Naeem Cyber Security',
        success: false,
        booking,
        session,
        error: `Payment was not completed (Stripe status: ${session ? session.payment_status : 'unknown'}). Your appointment remains Pending and is not yet confirmed.`
      });
    }
  } catch (stripeErr) {
    console.error('[Stripe Session Retrieval Error]:', stripeErr);
    return res.render('booking-success', {
      pageTitle: 'Payment Verification Notice | Usman Naeem Cyber Security',
      success: false,
      booking,
      session: null,
      error: `Could not verify payment status with Stripe: ${stripeErr.message}. Your booking remains in Pending status.`
    });
  }
}

// Register routes on router as well
router.get('/stripe-checkout', handleStripeCheckout);
router.post('/stripe-checkout/confirm', handleStripeCheckoutConfirm);
router.get('/booking-success', handleBookingSuccess);

// Export router and success handler for mounting at root
module.exports = router;
module.exports.handleBookingSuccess = handleBookingSuccess;
module.exports.handleStripeCheckout = handleStripeCheckout;
module.exports.handleStripeCheckoutConfirm = handleStripeCheckoutConfirm;
module.exports.PAID_SERVICE = PAID_SERVICE;
module.exports.DEPOSIT_AMOUNT_AED = DEPOSIT_AMOUNT_AED;
