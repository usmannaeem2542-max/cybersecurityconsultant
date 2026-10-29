const express = require('express');
const router = express.Router();
const appointmentService = require('../services/appointmentService');
const emailService = require('../services/emailService');

/**
 * Helper to obtain the current date string in Asia/Dubai (GST, UTC+4)
 * Formatted as YYYY-MM-DD
 */
function getDubaiDateString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}

/**
 * Middleware: Allows ONLY the "admin" role to access the admin dashboard and actions
 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  if (req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      pageTitle: 'Forbidden (403) | Admin Privilege Required',
      statusCode: 403,
      message: 'Access Denied: Only users with the "admin" role are authorized to access this dashboard.'
    });
  }

  next();
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

  // Create authenticated admin session
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

  const dubaiDate = getDubaiDateString();
  const todayBookings = bookings.filter(b => b.bookingDateTime && b.bookingDateTime.startsWith(dubaiDate));
  const todayBookingsCount = todayBookings.length;

  res.render('admin', {
    pageTitle: 'Admin Security Dashboard | Usman Naeem Cyber Security',
    user: req.session.user,
    bookings,
    enquiries,
    todayBookings,
    todayBookingsCount,
    dubaiDate,
    notification: req.query.msg || null,
    errorMessage: req.query.err || null
  });
});

// POST /admin/bookings/:id/completed - Mark booking as Completed
router.post('/admin/bookings/:id/completed', requireAdmin, (req, res) => {
  const bookingId = req.params.id;
  try {
    appointmentService.updateStatus(bookingId, 'Completed');
  } catch (err) {
    console.error(`Failed to mark booking #${bookingId} as Completed:`, err);
    return res.redirect('/admin?err=Failed%20to%20mark%20as%20Completed');
  }
  res.redirect(`/admin?msg=Booking%20%23${bookingId}%20marked%20as%20Completed`);
});

// POST /admin/bookings/:id/no-show - Mark booking as No-show
router.post('/admin/bookings/:id/no-show', requireAdmin, (req, res) => {
  const bookingId = req.params.id;
  try {
    appointmentService.updateStatus(bookingId, 'No-show');
  } catch (err) {
    console.error(`Failed to mark booking #${bookingId} as No-show:`, err);
    return res.redirect('/admin?err=Failed%20to%20mark%20as%20No-show');
  }
  res.redirect(`/admin?msg=Booking%20%23${bookingId}%20marked%20as%20No-show`);
});

// POST /admin/bookings/:id/cancel - Set booking status to Cancelled
router.post('/admin/bookings/:id/cancel', requireAdmin, (req, res) => {
  const bookingId = req.params.id;
  try {
    appointmentService.updateStatus(bookingId, 'Cancelled');
  } catch (err) {
    console.error(`Failed to cancel booking #${bookingId}:`, err);
    return res.redirect('/admin?err=Failed%20to%20cancel%20booking');
  }
  res.redirect(`/admin?msg=Booking%20%23${bookingId}%20cancelled%20successfully`);
});

// POST /admin/bookings/:id/status - Generic status update endpoint
router.post('/admin/bookings/:id/status', requireAdmin, (req, res) => {
  const bookingId = req.params.id;
  const { status } = req.body || {};
  const allowed = ['Completed', 'No-show', 'Cancelled', 'Booked', 'Pending'];
  if (!status || !allowed.includes(status)) {
    return res.redirect('/admin?err=Invalid%20status%20value');
  }
  try {
    appointmentService.updateStatus(bookingId, status);
  } catch (err) {
    console.error(`Failed to update booking #${bookingId} status to ${status}:`, err);
    return res.redirect('/admin?err=Failed%20to%20update%20status');
  }
  res.redirect(`/admin?msg=Booking%20%23${bookingId}%20updated%20to%20${encodeURIComponent(status)}`);
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

router.requireAdmin = requireAdmin;
router.getDubaiDateString = getDubaiDateString;

module.exports = router;
