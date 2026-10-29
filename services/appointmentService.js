const db = require('../data/db');
const bcrypt = require('bcryptjs');

// ============================================================================
// Prepared Statements (All queries use parameterized prepared statements only)
// ============================================================================

// Bookings Statements
const checkDoubleBookingStmt = db.prepare(`
  SELECT id, service, bookingDateTime, status 
  FROM bookings 
  WHERE bookingDateTime = ? AND status != 'Cancelled' 
  LIMIT 1
`);

const insertBookingStmt = db.prepare(`
  INSERT INTO bookings (
    service, 
    bookingDateTime, 
    clientName, 
    clientCompany, 
    clientPhone, 
    clientEmail, 
    message, 
    status, 
    stripeSessionId,
    createdAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getBookingByStripeSessionIdStmt = db.prepare(`
  SELECT * FROM bookings WHERE stripeSessionId = ? LIMIT 1
`);

const updateBookingStripeSessionIdStmt = db.prepare(`
  UPDATE bookings SET stripeSessionId = ? WHERE id = ?
`);

const getBookingByIdStmt = db.prepare(`
  SELECT * FROM bookings WHERE id = ?
`);

const getBookingsByEmailStmt = db.prepare(`
  SELECT * FROM bookings WHERE clientEmail = ? ORDER BY id DESC
`);

const getBookingsByDateStmt = db.prepare(`
  SELECT * FROM bookings WHERE bookingDateTime LIKE ? ORDER BY bookingDateTime ASC
`);

const listUpcomingBookingsStmt = db.prepare(`
  SELECT * FROM bookings ORDER BY bookingDateTime ASC
`);

const updateBookingStatusStmt = db.prepare(`
  UPDATE bookings SET status = ? WHERE id = ?
`);

const updateBookingEmailSentStmt = db.prepare(`
  UPDATE bookings SET confirmationEmailSentAt = ? WHERE id = ?
`);

const updateBookingReminderSentStmt = db.prepare(`
  UPDATE bookings SET lastReminderSentAt = ? WHERE id = ?
`);

// Enquiries Statements
const insertEnquiryStmt = db.prepare(`
  INSERT INTO enquiries (name, email, company, message, createdAt)
  VALUES (?, ?, ?, ?, ?)
`);

const getEnquiryByIdStmt = db.prepare(`
  SELECT * FROM enquiries WHERE id = ?
`);

const listEnquiriesStmt = db.prepare(`
  SELECT * FROM enquiries ORDER BY id DESC
`);

// Users / Auth Statements
const findUserByEmailStmt = db.prepare(`
  SELECT * FROM users WHERE email = ? LIMIT 1
`);

const insertUserStmt = db.prepare(`
  INSERT INTO users (email, passwordHash, role, createdAt)
  VALUES (?, ?, ?, ?)
`);

const updateUserPasswordStmt = db.prepare(`
  UPDATE users SET passwordHash = ? WHERE email = ?
`);

// ============================================================================
// Bookings Operations
// ============================================================================

/**
 * Creates a new booking in SQLite database.
 * Blocks double-booking: the same bookingDateTime cannot be saved twice unless the first is 'Cancelled'.
 */
function createBooking({
  service,
  bookingDateTime,
  clientName,
  clientCompany,
  clientPhone,
  clientEmail,
  message,
  status = 'Booked',
  stripeSessionId = null
}) {
  if (!service || !bookingDateTime || !clientName || !clientEmail || !clientPhone) {
    throw new Error('Missing required booking fields.');
  }

  // Double-booking check
  const existing = checkDoubleBookingStmt.get(bookingDateTime);
  if (existing) {
    const err = new Error(`The requested time slot (${bookingDateTime}) has already been reserved. Please select another slot.`);
    err.code = 'DOUBLE_BOOKING';
    throw err;
  }

  const now = new Date().toISOString();
  const info = insertBookingStmt.run(
    service,
    bookingDateTime,
    clientName,
    clientCompany || null,
    clientPhone,
    clientEmail,
    message || '',
    status || 'Booked',
    stripeSessionId || null,
    now
  );

  const bookingId = Number(info.lastInsertRowid);
  return getBookingByIdStmt.get(bookingId);
}

/**
 * Retrieves all bookings associated with a client's email address.
 */
function getBookingsByEmail(email) {
  if (!email) return [];
  return getBookingsByEmailStmt.all(email.trim());
}

/**
 * Retrieves all bookings for a given date pattern (e.g. 'YYYY-MM-DD').
 */
function getBookingsByDate(date) {
  if (!date) return [];
  const searchPattern = `${date.trim()}%`;
  return getBookingsByDateStmt.all(searchPattern);
}

/**
 * Retrieves upcoming bookings sorted soonest first (ascending by date & time).
 */
function listUpcomingBookings() {
  const all = listUpcomingBookingsStmt.all();
  return all.sort((a, b) => {
    const parseSlotDate = (str) => {
      if (!str) return 0;
      try {
        const parts = str.trim().split(' ');
        const datePart = parts[0];
        const timePart = parts[1];
        const meridiem = parts[2];
        const [year, month, day] = datePart.split('-').map(Number);
        let [hours, minutes] = timePart.split(':').map(Number);
        if (meridiem === 'PM' && hours < 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
        return new Date(Date.UTC(year, month - 1, day, hours, minutes)).getTime();
      } catch (e) {
        return 0;
      }
    };
    return parseSlotDate(a.bookingDateTime) - parseSlotDate(b.bookingDateTime);
  });
}

/**
 * Updates the status of an existing booking (e.g. 'Booked', 'Completed', 'Cancelled').
 */
function updateStatus(id, newStatus) {
  if (!id || !newStatus) {
    throw new Error('Booking ID and new status are required.');
  }
  const numericId = Number(id);
  updateBookingStatusStmt.run(newStatus, numericId);
  return getBookingByIdStmt.get(numericId);
}

/**
 * Retrieves a booking record by its associated Stripe Checkout Session ID.
 */
function getBookingByStripeSessionId(stripeSessionId) {
  if (!stripeSessionId) return null;
  return getBookingByStripeSessionIdStmt.get(stripeSessionId.trim());
}

/**
 * Associates a Stripe Checkout Session ID with an existing booking.
 */
function updateStripeSessionId(id, stripeSessionId) {
  if (!id || !stripeSessionId) {
    throw new Error('Booking ID and stripeSessionId are required.');
  }
  const numericId = Number(id);
  updateBookingStripeSessionIdStmt.run(stripeSessionId.trim(), numericId);
  return getBookingByIdStmt.get(numericId);
}

/**
 * Retrieves a booking by its primary ID.
 */
function getBookingById(id) {
  if (!id) return null;
  return getBookingByIdStmt.get(Number(id));
}

/**
 * Records the timestamp when the confirmation email was sent.
 */
function markConfirmationEmailSent(id) {
  if (!id) return;
  const now = new Date().toISOString();
  updateBookingEmailSentStmt.run(now, Number(id));
}

/**
 * Records the timestamp when a reminder email was sent.
 */
function markReminderSent(id) {
  if (!id) return;
  const now = new Date().toISOString();
  updateBookingReminderSentStmt.run(now, Number(id));
}

// ============================================================================
// Enquiries Operations
// ============================================================================

/**
 * Inserts a new contact inquiry into the enquiries table.
 */
function createEnquiry({ name, email, company, message }) {
  if (!name || !email || !message) {
    throw new Error('Name, email, and message are required.');
  }
  const now = new Date().toISOString();
  const info = insertEnquiryStmt.run(
    name,
    email,
    company || null,
    message,
    now
  );
  const enquiryId = Number(info.lastInsertRowid);
  return getEnquiryByIdStmt.get(enquiryId);
}

/**
 * Lists all contact enquiries ordered by newest first.
 */
function listEnquiries() {
  return listEnquiriesStmt.all();
}

// ============================================================================
// Users & Authentication Operations
// ============================================================================

/**
 * Finds user by email address.
 */
function findUserByEmail(email) {
  if (!email) return null;
  return findUserByEmailStmt.get(email.trim().toLowerCase());
}

/**
 * Seeds or updates the single admin user on startup from ADMIN_EMAIL and ADMIN_PASSWORD.
 * Passwords are always hashed with bcryptjs before storing.
 */
function seedAdminUser(email, plainPassword) {
  if (!email || !plainPassword) {
    console.warn('[Auth] ADMIN_EMAIL or ADMIN_PASSWORD not configured. Skipping admin seed.');
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = findUserByEmail(normalizedEmail);
  const passwordHash = bcrypt.hashSync(plainPassword, 10);

  if (!existing) {
    const now = new Date().toISOString();
    insertUserStmt.run(normalizedEmail, passwordHash, 'admin', now);
    console.log(`[Auth] Seeded new admin account: ${normalizedEmail}`);
  } else {
    // Keep admin password synchronized with environment variables
    updateUserPasswordStmt.run(passwordHash, normalizedEmail);
    console.log(`[Auth] Synchronized admin password for: ${normalizedEmail}`);
  }

  return findUserByEmail(normalizedEmail);
}

/**
 * Verifies email and password against stored bcrypt hash.
 */
function validateUserCredentials(email, plainPassword) {
  if (!email || !plainPassword) return null;
  const user = findUserByEmail(email);
  if (!user) return null;

  const isMatch = bcrypt.compareSync(plainPassword, user.passwordHash);
  if (!isMatch) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role
  };
}

module.exports = {
  createBooking,
  getBookingById,
  getBookingsByEmail,
  getBookingsByDate,
  listUpcomingBookings,
  updateStatus,
  getBookingByStripeSessionId,
  updateStripeSessionId,
  markConfirmationEmailSent,
  markReminderSent,
  createEnquiry,
  listEnquiries,
  findUserByEmail,
  seedAdminUser,
  validateUserCredentials
};
