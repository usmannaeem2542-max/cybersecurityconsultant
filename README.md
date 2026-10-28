# Usman Naeem Cyber Security Consulting

An enterprise-grade, high-performance web application for **Usman Naeem**, an independent cyber security consultant based in Dubai, UAE (operating remotely worldwide).

> *"Find the gaps before attackers do."*

---

## 🛡️ Core Services

1. **Vulnerability Assessment** — Automated and manual vulnerability scans, network & host configuration review, CVSS-scored remediation roadmaps.
2. **Penetration Testing** — Real-world adversary simulation across web apps, APIs, networks, and cloud environments (OWASP Top 10, PTES).
3. **Security Awareness Training** — Simulated phishing campaigns, interactive social engineering defense, and security hygiene workshops.
4. **Compliance & Policy Review (ISO 27001)** — Gap analysis, information security management system (ISMS) documentation, and audit readiness.

---

## ⚡ Tech Stack & Architecture

- **Runtime**: Node.js (v20+ / v22+)
- **Server Framework**: Express.js
- **Templating Engine**: EJS with reusable partials
- **Database**: Built-in `node:sqlite` (`DatabaseSync` - Zero external database drivers or native compilation required)
- **Authentication**: `express-session` with pure-JavaScript `bcryptjs` for salted password hashing
- **Security & Cookies**: `httpOnly`, `sameSite: 'lax'`, `secure` in production, CSRF/XSS escaping
- **Styling**: Vanilla CSS design system with dark navy (`#060b19`), cyber teal (`#00f5d4`), and cyan accents, Bootstrap 5 & Bootstrap Icons

---

## 🚀 Key Features

- **Interactive Discovery Booking Wizard (`/booking`)**:
  - Step 1: Service selection.
  - Step 2: Date & 30-minute time slot selection (Mon–Fri 10am–5pm GST, Asia/Dubai time zone, past dates disabled).
  - Step 3: Client contact details with server-side validation and sanitization.
  - **Double-Booking Prevention**: Prepared statement checks ensure duplicate active bookings for the same time slot cannot be made.
- **Bot-Resistant Contact Inquiries (`/contact`)**:
  - Direct inquiry submission with a hidden honeypot field to filter spam bots.
- **Protected Security Operations Dashboard (`/admin`)**:
  - Authentication at `/login` with session management and secure logout at `/logout`.
  - **Upcoming Bookings**: Chronologically sorted (soonest first) with client details and instant slot cancellation.
  - **Client Enquiries**: Real-time view of all contact messages (newest first).
  - Releasing cancelled slots dynamically allows clients to re-book.

---

## 📦 Getting Started

### 1. Prerequisites
- Node.js (v20.6 or higher recommended for native SQLite & `process.loadEnvFile`)
- Git

### 2. Installation
```bash
git clone https://github.com/usmannaeem2542-max/cybersecurityconsultant.git
cd cybersecurityconsultant
npm install
```

### 3. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Configure your environment variables:
```ini
PORT=3000
SESSION_SECRET=your_long_random_session_secret_key
ADMIN_EMAIL=admin@usmancybersecurity.com
ADMIN_PASSWORD="YourStrongAdminPassword"
DB_PATH=data/consultant.db
```

### 4. Running the Application
```bash
# Development mode with auto-reload
npm run dev

# Production start
npm start
```

Visit the website at `http://localhost:3000`.

---

## 🔒 Confidentiality & Security
All technical engagements and client assessments adhere to strict non-disclosure agreements (NDAs) and industry standards.
