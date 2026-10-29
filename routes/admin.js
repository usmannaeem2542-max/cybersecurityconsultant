const express = require('express');
const router = express.Router();
const appointmentService = require('../services/appointmentService');
const emailService = require('../services/emailService');

// Middleware to protect admin routes
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.redirect('/login');
}

// GET /login - Show login page
router.get('/login', (req, res) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return res.redirect('/admin');
  }
  res.render('login', {
    pageTitle: 'Admin Access | Usman Naeem Cyber Security',
    error: null,
    emailValue: ''
  });
});

// POST /login - Authenticate admin credentials
router.post('/login', (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).render('login', {
      pageTitle: 'Admin Access | Usman Naeem Cyber Security',
      error: 'Please enter both email and password.',
      emailValue: email
    });
  }

  const user = appointmentService.validateUserCredentials(email, password);

  if (!user || user.role !== 'admin') {
    return res.status(401).render('login', {
      pageTitle: 'Admin Access | Usman Naeem Cyber Security',
      error: 'Invalid email or password. Access denied.',
      emailValue: email
    });
  }

  // Create session
  req.session.user = {
    id: user.id,
    email: user.email,
    role: user.role
  };

  res.redirect('/admin');
});

// GET /logout & POST /logout - Terminate session
router.all('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  } else {
    res.redirect('/login');
  }
});

// GET /admin - Protected Admin Dashboard
router.get('/admin', requireAdmin, (req, res) => {
  const bookings = appointmentService.listUpcomingBookings();
  const enquiries = appointmentService.listEnquiries();

  res.render('admin', {
    pageTitle: 'Admin Security Dashboard | Usman Naeem Cyber Security',
    user: req.session.user,
    bookings,
    enquiries,
    notification: req.query.msg || null,
    errorMessage: req.query.err || null
  });
});

// POST /admin/bookings/:id/cancel - Set booking status to Cancelled
router.post('/admin/bookings/:id/cancel', requireAdmin, (req, res) => {
  const bookingId = req.params.id;
  try {
    appointmentService.updateStatus(bookingId, 'Cancelled');
  } catch (err) {
    console.error(`Failed to cancel booking #${bookingId}:`, err);
  }
  res.redirect('/admin?msg=Booking%20cancelled%20successfully');
});

// POST /admin/bookings/:id/send-reminder - Send session reminder email to client
router.post('/admin/bookings/:id/send-reminder', requireAdmin, async (req, res) => {
  const bookingId = req.params.id;
  try {
    const booking = appointmentService.getBookingById(bookingId);
    if (!booking) {
      return res.redirect('/admin?err=Booking%20not%20found');
    }

    if (booking.status !== 'Booked') {
      return res.redirect('/admin?err=Reminders%20can%20only%20be%20sent%20for%20confirmed%20Booked%20sessions');
    }

    const result = await emailService.sendBookingReminder(booking);
    if (result.success) {
      return res.redirect(`/admin?msg=Reminder%20email%20sent%20successfully%20to%20${encodeURIComponent(booking.clientEmail)}`);
    } else {
      return res.redirect(`/admin?err=Failed%20to%20send%20reminder:%20${encodeURIComponent(result.error || 'SMTP delivery issue')}`);
    }
  } catch (err) {
    console.error(`[Admin Reminder Error] Booking #${bookingId}:`, err);
    return res.redirect(`/admin?err=Error%20sending%20reminder:%20${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;
