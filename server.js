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

// Trust reverse proxy (Vercel / Cloudflare / Nginx) for secure HTTPS cookies
app.set('trust proxy', 1);

// Set EJS as templating engine
app.set('view engine', 'ejs');
const viewsDir = fs.existsSync(path.join(process.cwd(), 'views'))
  ? path.join(process.cwd(), 'views')
  : path.join(__dirname, 'views');
app.set('views', viewsDir);

// Serve static assets from public directory
const publicDir = fs.existsSync(path.join(process.cwd(), 'public'))
  ? path.join(process.cwd(), 'public')
  : path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
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
  next();
});

// Import Routers
const bookingRouter = require('./routes/booking');
const contactRouter = require('./routes/contact');
const adminRouter = require('./routes/admin');

// Mount Routers
app.use('/booking', bookingRouter);
app.use('/contact', contactRouter);
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

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('[Application Error]:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Application Notice | Usman Naeem Cyber Security</title>
      <link rel="stylesheet" href="/css/site.css">
    </head>
    <body style="background: #060b19; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem;">
      <div style="background: rgba(12, 21, 46, 0.9); border: 1px solid rgba(0, 245, 212, 0.3); border-radius: 12px; padding: 2.5rem; max-width: 600px; text-align: center;">
        <h2 style="color: #00f5d4; margin-bottom: 1rem;">Service Temporarily Updating</h2>
        <p style="color: #94a3b8; margin-bottom: 1.5rem;">${err.message || 'The requested resource encountered a brief startup delay.'}</p>
        <a href="/" style="background: #00f5d4; color: #060b19; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 700;">Return to Home</a>
      </div>
    </body>
    </html>
  `);
});

// Start server (only if not running under a serverless platform like Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Usman Naeem Cyber Security Consulting running at http://localhost:${PORT}`);
  });
}

module.exports = app;
