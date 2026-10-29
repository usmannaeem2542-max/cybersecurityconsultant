const crypto = require('node:crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

/**
 * Helmet configuration with a sensible Content-Security-Policy (CSP)
 * Allows Bootstrap CDN (js & icons) and Google Fonts
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://fonts.gstatic.com"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false
});

/**
 * Rate Limiters for sensitive endpoints
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts from this IP. Please try again after 15 minutes.'
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 enquiries per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many enquiry requests submitted from this IP. Please try again later.'
});

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 booking requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many booking attempts from this IP. Please try again later.'
});

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 assistant messages per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Please wait a moment before sending more messages.' }
});

/**
 * Per-Session CSRF Token Generation & Validation
 * Uses cryptographically secure random bytes from node:crypto
 */
function sessionCsrf(req, res, next) {
  if (req.session) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
  }
  next();
}

/**
 * CSRF Validation Middleware for POST/PUT/DELETE requests
 */
function verifyCsrfToken(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Exempt JSON API endpoints like /api/* while keeping rate limiting active
  if (req.path.startsWith('/api') || req.baseUrl.startsWith('/api')) {
    return next();
  }

  const sessionToken = req.session ? req.session.csrfToken : null;
  const submittedToken = (req.body && req.body._csrf) || req.headers['x-csrf-token'];

  if (!sessionToken || !submittedToken || sessionToken !== submittedToken) {
    console.warn(`[CSRF] Rejected unauthorized request: ${req.method} ${req.originalUrl}`);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({ error: 'Invalid or missing CSRF token.' });
    }
    return res.status(403).render('error', {
      pageTitle: 'Forbidden (403) | Security Verification Failed',
      statusCode: 403,
      message: 'Security validation failed: Invalid or missing CSRF token. Please refresh the page and try again.'
    });
  }

  next();
}

module.exports = {
  helmetMiddleware,
  loginLimiter,
  contactLimiter,
  bookingLimiter,
  chatLimiter,
  sessionCsrf,
  verifyCsrfToken
};
