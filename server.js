const fs = require('fs');
const path = require('path');

// Load environment variables from .env if the file exists (Node 20.6+)
// Reloaded with quoted ADMIN_PASSWORD
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}

const express = require('express');
const session = require('express-session');
const appointmentService = require('./services/appointmentService');

// Seed single admin user from environment variables on startup
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  appointmentService.seedAdminUser(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (Vercel / Cloudflare / Nginx) for secure HTTPS cookies and rate limiting
app.set('trust proxy', 1);

// Security: Helmet with sensible Content-Security-Policy (allows Bootstrap CDN)
const {
  helmetMiddleware,
  loginLimiter,
  contactLimiter,
  bookingLimiter,
  chatLimiter,
  sessionCsrf,
  verifyCsrfToken
} = require('./middleware/security');
app.use(helmetMiddleware);

// Set EJS as templating engine
const viewsDir = fs.existsSync(path.join(process.cwd(), 'views'))
  ? path.join(process.cwd(), 'views')
  : path.join(__dirname, 'views');
app.set('view engine', 'ejs');
app.set('views', viewsDir);

// Serve static assets from public directory
const publicDir = fs.existsSync(path.join(process.cwd(), 'public'))
  ? path.join(process.cwd(), 'public')
  : path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration (httpOnly, sameSite lax, secure in production)
app.use(session({
  secret: process.env.SESSION_SECRET || 'usman-naeem-cyber-security-session-key-random',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Security: Per-Session CSRF Token generation with node:crypto
app.use(sessionCsrf);

// Default view locals available across all templates
app.use((req, res, next) => {
  res.locals.brandName = 'Usman Naeem Cyber Security Consulting';
  res.locals.consultantName = 'Usman Naeem';
  res.locals.tagline = 'Find the gaps before attackers do';
  res.locals.email = 'usman@usmancybersecurity.com';
  res.locals.phone = '+971 4 234 5678';
  res.locals.location = 'Dubai, UAE · Remote Worldwide';
  res.locals.availability = 'Mon–Fri 9am–6pm GST';
  res.locals.pageTitle = 'Usman Naeem Cyber Security Consulting | Independent Consultant Dubai';
  res.locals.currentUser = (req.session && req.session.user) ? req.session.user : null;
  res.locals.csrfToken = req.session ? req.session.csrfToken : '';
  next();
});

// Security: Apply rate limits to sensitive routes
app.use('/login', loginLimiter);
app.use('/contact', contactLimiter);
app.use('/booking', bookingLimiter);
app.use('/api/chat', chatLimiter);

// Security: Verify CSRF token on all POST requests
app.use(verifyCsrfToken);

// Import Routers
const bookingRouter = require('./routes/booking');
const contactRouter = require('./routes/contact');
const adminRouter = require('./routes/admin');
const chatRouter = require('./routes/chat');

// Mount Routers
app.use('/booking', bookingRouter);
app.use('/contact', contactRouter);
app.use('/api', chatRouter);
app.get('/booking-success', (req, res, next) => bookingRouter.handleBookingSuccess(req, res, next));
app.get('/stripe-checkout', (req, res, next) => bookingRouter.handleStripeCheckout(req, res, next));
app.post('/stripe-checkout/confirm', (req, res, next) => bookingRouter.handleStripeCheckoutConfirm(req, res, next));
app.use('/', adminRouter);

app.get('/', (req, res) => {
  res.render('index', {
    pageTitle: 'Usman Naeem Cyber Security Consulting | Independent Cyber Security Consultant Dubai',
    brandName: 'Usman Naeem Cyber Security Consulting',
    tagline: 'Find the gaps before attackers do',
    consultantName: 'Usman Naeem',
    location: 'Dubai, UAE · Remote Worldwide',
    email: 'usman@usmancybersecurity.com',
    phone: '+971 4 234 5678',
    availability: 'Mon–Fri 9am–6pm GST'
  });
});

// 404 handler - catch all unmatched routes and render generic error page
app.use((req, res) => {
  res.status(404).render('error', {
    pageTitle: 'Page Not Found (404) | Usman Naeem Cyber Security',
    statusCode: 404,
    message: 'The requested resource could not be found or may have been relocated.'
  });
});

// Global error handling middleware (generic error page that never shows stack traces)
app.use((err, req, res, next) => {
  console.error('[Application Error]:', err.message);
  if (res.headersSent) {
    return next(err);
  }
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).render('error', {
    pageTitle: `Application Notice (${statusCode}) | Usman Naeem Cyber Security`,
    statusCode,
    message: 'An unexpected application condition occurred. For security and privacy, technical stack traces are strictly suppressed.'
  });
});

// Start server (only if not running under a serverless platform like Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Usman Naeem Cyber Security Consulting running at http://localhost:${PORT}`);
  });
}

module.exports = app;
