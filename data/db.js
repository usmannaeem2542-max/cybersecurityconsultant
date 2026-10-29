const path = require('path');
const fs = require('fs');

// Resolve database file path (default to data/consultant.db, or /tmp/consultant.db on Vercel)
const isVercel = Boolean(process.env.VERCEL);
const dbFilePath = process.env.DB_PATH || (isVercel ? '/tmp/consultant.db' : path.join(__dirname, 'consultant.db'));
const dbDir = path.dirname(dbFilePath);

// Ensure the directory exists
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch (e) {
    // Ignore in read-only filesystems
  }
}

let db;

try {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(dbFilePath);

  // Enable foreign key support
  db.exec('PRAGMA foreign_keys = ON;');

  // Initialize tables if they do not exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service TEXT NOT NULL,
      bookingDateTime TEXT NOT NULL,
      clientName TEXT NOT NULL,
      clientCompany TEXT,
      clientPhone TEXT NOT NULL,
      clientEmail TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'Booked',
      stripeSessionId TEXT,
      confirmationEmailSentAt TEXT,
      lastReminderSentAt TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      message TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      createdAt TEXT NOT NULL
    );
  `);

  // Ensure stripeSessionId column exists in bookings table, only if it is missing
  try {
    const tableInfo = db.prepare('PRAGMA table_info(bookings)').all();
    const hasStripeSessionId = tableInfo.some(col => col.name === 'stripeSessionId');
    if (!hasStripeSessionId) {
      db.exec('ALTER TABLE bookings ADD COLUMN stripeSessionId TEXT;');
      console.log('[Database] Added stripeSessionId column to existing bookings table');
    }

    const hasEmailSentCol = tableInfo.some(col => col.name === 'confirmationEmailSentAt');
    if (!hasEmailSentCol) {
      db.exec('ALTER TABLE bookings ADD COLUMN confirmationEmailSentAt TEXT;');
      console.log('[Database] Added confirmationEmailSentAt column to existing bookings table');
    }

    const hasReminderCol = tableInfo.some(col => col.name === 'lastReminderSentAt');
    if (!hasReminderCol) {
      db.exec('ALTER TABLE bookings ADD COLUMN lastReminderSentAt TEXT;');
      console.log('[Database] Added lastReminderSentAt column to existing bookings table');
    }
  } catch (colErr) {
    console.warn('[Database] Could not verify/alter bookings table columns:', colErr.message);
  }

  console.log('[Database] Initialized via native node:sqlite');
} catch (nativeErr) {
  console.warn('[Database] Native node:sqlite unavailable in this environment, using serverless fallback:', nativeErr.message);

  // Fallback storage engine for environments without native node:sqlite (e.g. Vercel Node 18/20)
  const jsonPath = dbFilePath.endsWith('.db') ? dbFilePath.replace(/\.db$/, '.json') : dbFilePath + '.json';
  
  let store = {
    bookings: [],
    enquiries: [],
    users: [],
    nextId: { bookings: 1, enquiries: 1, users: 1 }
  };

  try {
    if (fs.existsSync(jsonPath)) {
      store = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    }
  } catch (e) {
    // Start fresh
  }

  function saveStore() {
    try {
      fs.writeFileSync(jsonPath, JSON.stringify(store, null, 2));
    } catch (e) {
      // Ignore in read-only storage
    }
  }

  db = {
    exec: () => {},
    prepare: (sql) => {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      return {
        run: (...params) => {
          if (normalizedSql.startsWith('INSERT INTO bookings')) {
            let service, bookingDateTime, clientName, clientCompany, clientPhone, clientEmail, message, status, stripeSessionId, createdAt;
            if (params.length === 10) {
              [service, bookingDateTime, clientName, clientCompany, clientPhone, clientEmail, message, status, stripeSessionId, createdAt] = params;
            } else {
              [service, bookingDateTime, clientName, clientCompany, clientPhone, clientEmail, message, status, createdAt] = params;
              stripeSessionId = null;
            }
            const id = store.nextId.bookings++;
            const record = { id, service, bookingDateTime, clientName, clientCompany, clientPhone, clientEmail, message, status: status || 'Booked', stripeSessionId: stripeSessionId || null, createdAt };
            store.bookings.push(record);
            saveStore();
            return { lastInsertRowid: id };
          }
          if (normalizedSql.startsWith('INSERT INTO enquiries')) {
            const [name, email, company, message, createdAt] = params;
            const id = store.nextId.enquiries++;
            const record = { id, name, email, company, message, createdAt };
            store.enquiries.push(record);
            saveStore();
            return { lastInsertRowid: id };
          }
          if (normalizedSql.startsWith('INSERT INTO users')) {
            const [email, passwordHash, role, createdAt] = params;
            const id = store.nextId.users++;
            const record = { id, email, passwordHash, role: role || 'admin', createdAt };
            store.users.push(record);
            saveStore();
            return { lastInsertRowid: id };
          }
          if (normalizedSql.startsWith('UPDATE bookings SET status = ? WHERE id = ?')) {
            const [status, id] = params;
            const b = store.bookings.find(item => item.id === Number(id));
            if (b) b.status = status;
            saveStore();
            return {};
          }
          if (normalizedSql.startsWith('UPDATE bookings SET stripeSessionId = ? WHERE id = ?')) {
            const [sessionId, id] = params;
            const b = store.bookings.find(item => item.id === Number(id));
            if (b) b.stripeSessionId = sessionId;
            saveStore();
            return {};
          }
          if (normalizedSql.startsWith('UPDATE bookings SET confirmationEmailSentAt = ? WHERE id = ?')) {
            const [sentAt, id] = params;
            const b = store.bookings.find(item => item.id === Number(id));
            if (b) b.confirmationEmailSentAt = sentAt;
            saveStore();
            return {};
          }
          if (normalizedSql.startsWith('UPDATE bookings SET lastReminderSentAt = ? WHERE id = ?')) {
            const [sentAt, id] = params;
            const b = store.bookings.find(item => item.id === Number(id));
            if (b) b.lastReminderSentAt = sentAt;
            saveStore();
            return {};
          }
          if (normalizedSql.startsWith('UPDATE users SET passwordHash = ? WHERE email = ?')) {
            const [passwordHash, email] = params;
            const u = store.users.find(item => item.email.toLowerCase() === email.toLowerCase());
            if (u) u.passwordHash = passwordHash;
            saveStore();
            return {};
          }
          return {};
        },
        get: (...params) => {
          if (normalizedSql.includes('FROM bookings') && normalizedSql.includes('bookingDateTime = ? AND status != \'Cancelled\'')) {
            const [dt] = params;
            return store.bookings.find(b => b.bookingDateTime === dt && b.status !== 'Cancelled') || null;
          }
          if (normalizedSql.includes('FROM bookings WHERE id = ?')) {
            const [id] = params;
            return store.bookings.find(b => b.id === Number(id)) || null;
          }
          if (normalizedSql.includes('FROM bookings WHERE stripeSessionId = ?')) {
            const [sessionId] = params;
            return store.bookings.find(b => b.stripeSessionId === sessionId) || null;
          }
          if (normalizedSql.includes('FROM enquiries WHERE id = ?')) {
            const [id] = params;
            return store.enquiries.find(e => e.id === Number(id)) || null;
          }
          if (normalizedSql.includes('FROM users WHERE email = ?')) {
            const [email] = params;
            return store.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase()) || null;
          }
          return null;
        },
        all: (...params) => {
          if (normalizedSql.includes('FROM bookings WHERE clientEmail = ?')) {
            const [email] = params;
            return store.bookings.filter(b => b.clientEmail.toLowerCase() === (email || '').toLowerCase()).reverse();
          }
          if (normalizedSql.includes('FROM bookings WHERE bookingDateTime LIKE ?')) {
            const [pattern] = params;
            const prefix = pattern.replace(/%/g, '');
            return store.bookings.filter(b => b.bookingDateTime.startsWith(prefix));
          }
          if (normalizedSql.includes('FROM bookings ORDER BY bookingDateTime ASC')) {
            return [...store.bookings];
          }
          if (normalizedSql.includes('FROM enquiries ORDER BY id DESC')) {
            return [...store.enquiries].reverse();
          }
          return [];
        }
      };
    }
  };
}

module.exports = db;
