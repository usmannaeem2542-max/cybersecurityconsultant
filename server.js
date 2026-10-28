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

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));
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

// Start server
app.listen(PORT, () => {
  console.log(`Usman Naeem Cyber Security Consulting running at http://localhost:${PORT}`);
});
