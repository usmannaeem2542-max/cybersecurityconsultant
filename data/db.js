const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// Resolve database file path (default to data/consultant.db, or /tmp/consultant.db on Vercel)
const isVercel = Boolean(process.env.VERCEL);
const dbFilePath = process.env.DB_PATH || (isVercel ? '/tmp/consultant.db' : path.join(__dirname, 'consultant.db'));
const dbDir = path.dirname(dbFilePath);

// Ensure the directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Open SQLite database connection using Node's built-in module
const db = new DatabaseSync(dbFilePath);

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

module.exports = db;
