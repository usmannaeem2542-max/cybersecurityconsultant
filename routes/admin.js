const express = require('express');
const router = express.Router();
const appointmentService = require('../services/appointmentService');

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
    notification: req.query.msg || null
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

module.exports = router;
