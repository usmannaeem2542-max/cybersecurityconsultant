# Security Architecture & Controls

This document details the security controls, hardening measures, and defense-in-depth architecture implemented across **Usman Naeem Cyber Security Consulting**.

---

## 1. Role-Based Access Control (RBAC) & Authentication
- **Role Column & Migration**: The `users` table contains a `role` column defaulting to `'client'` (`role TEXT NOT NULL DEFAULT 'client'`).
  - **Location**: [`data/db.js`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/data/db.js)
- **Seeded Administrator**: The initial administrative account is seeded securely from `ADMIN_EMAIL` and `ADMIN_PASSWORD` (stored exclusively as bcrypt hashes) with role `'admin'`.
  - **Location**: [`services/appointmentService.js`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/services/appointmentService.js)
- **Privilege Enforcement Middleware**: The `requireAdmin` middleware inspects the session role and strictly restricts access to `/admin` and related management actions to users with `role === 'admin'`. Non-authenticated visitors are redirected to `/login`; unauthorized users receive HTTP 403 Forbidden.
  - **Location**: [`routes/admin.js`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/routes/admin.js)

---

## 2. HTTP Security Headers & Content Security Policy (CSP)
- **Helmet Middleware**: Integrated `helmet` to manage HTTP headers, disabling MIME sniffing, restricting framing (Clickjacking protection), and enforcing HTTPS transport rules.
- **Content-Security-Policy (CSP)**: Sensible policy that allows legitimate external dependencies (Bootstrap 5 CDN, Bootstrap Icons CDN, and Google Fonts) while blocking untrusted scripts, object tags, and unauthorized connections.
  - **Location**: [`middleware/security.js`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/middleware/security.js) (mounted in [`server.js`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/server.js))

---

## 3. Rate Limiting (Brute-Force & Abuse Mitigation)
- **Express-Rate-Limit**: Pure JavaScript rate limiters applied to critical endpoints:
  - **`/login`**: 10 requests per 15 minutes (mitigates credential stuffing and brute-forcing).
  - **`/contact`**: 15 requests per 15 minutes (prevents lead form spam).
  - **`/booking`**: 20 requests per 15 minutes (prevents booking slot exhaustion).
  - **`/api/chat`**: 30 requests per 15 minutes (prevents AI token abuse).
  - **Location**: [`middleware/security.js`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/middleware/security.js) (applied in [`server.js`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/server.js))

---

## 4. Cross-Site Request Forgery (CSRF) Protection
- **Cryptographic Token Generation**: Per-session tokens generated using cryptographically secure pseudorandom numbers from `node:crypto` (`crypto.randomBytes(32).toString('hex')`).
- **Validation Middleware**: All state-changing `POST` requests are validated against the active session token (`_csrf` form field or `X-CSRF-Token` header).
  - **Location**: [`middleware/security.js`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/middleware/security.js)
- **Form Integration**: Hidden `<input type="hidden" name="_csrf" value="...">` fields embedded in:
  - Login form ([`views/login.ejs`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/views/login.ejs))
  - Booking wizard ([`views/booking.ejs`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/views/booking.ejs))
  - Contact forms ([`views/contact.ejs`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/views/contact.ejs), [`views/index.ejs`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/views/index.ejs))
  - Admin status updates & reminders ([`views/admin.ejs`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/views/admin.ejs))
  - Stripe checkout confirmation ([`views/stripe-checkout.ejs`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/views/stripe-checkout.ejs))
  - Chat assistant AJAX header (`X-CSRF-Token`) in [`views/partials/footer.ejs`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/views/partials/footer.ejs)

---

## 5. Session Security
- **Cookie Flags**:
  - `httpOnly: true`: Prevents client-side JavaScript access (XSS token theft mitigation).
  - `sameSite: 'lax'`: Protects against cross-site request forgery via top-level navigations.
  - `secure: true` (in production): Transmits cookies strictly over HTTPS.
  - `trust proxy: 1`: Properly passes TLS status from reverse proxies (Vercel, Cloudflare, Nginx).
  - **Location**: [`server.js`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/server.js)

---

## 6. Information Leakage & Error Handling
- **Stack Trace Suppression**: The global error handler catches application errors, logs technical details to server logs, and renders a generic, user-friendly security notice without ever exposing stack traces, paths, or database schemas.
  - **Location**: [`server.js`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/server.js) and [`views/error.ejs`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/views/error.ejs)
- **Secrets Management**: Sensitive credentials (`ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `SESSION_SECRET`, `ADMIN_PASSWORD`) are loaded strictly from environment variables and omitted from version control via [`.gitignore`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/.gitignore).

---

## 7. Contextual Output Encoding (XSS Mitigation)
- **Escaped Templates**: All user inputs (names, companies, emails, messages, inquiries) rendered using EJS HTML-escaped syntax (`<%= %>`) rather than raw unescaped evaluation (`<%- %>`).
  - **Location**: [`views/admin.ejs`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/views/admin.ejs), [`views/booking.ejs`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/views/booking.ejs), [`views/contact.ejs`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/views/contact.ejs)

---

## 8. AI Safety & Offensive Security Guardrails
- **Grounded Scope**: Limits conversation to verified consulting domain information.
- **Security Guardrail**: Automatically rejects hacking instructions, exploit creation, malware generation, unauthorized testing, and legal advice.
  - **Location**: [`services/assistantService.js`](file:///c:/Users/PC/Application%20Dev/Cyber%20Security/services/assistantService.js)
