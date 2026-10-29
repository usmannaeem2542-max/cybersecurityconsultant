const nodemailer = require('nodemailer');
const appointmentService = require('./appointmentService');

// Helper: Escape HTML strings to prevent email HTML injection
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Creates and configures the Nodemailer SMTP transporter using .env variables.
 * Fallback to jsonTransport in test/development if SMTP_HOST is not configured
 * or placeholder test credentials are used.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const isPlaceholder = !host || 
    !user || 
    !pass || 
    user.includes('test_smtp') || 
    user.includes('your_smtp') || 
    pass.includes('test_smtp') || 
    pass.includes('your_smtp');

  if (isPlaceholder) {
    // Development fallback: logs email as JSON without throwing connection or auth errors
    return nodemailer.createTransport({
      jsonTransport: true
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    }
  });
}

/**
 * Sends a booking confirmation email to the client upon becoming "Booked".
 * Enforces single-send: if confirmationEmailSentAt is already set, skips sending.
 * If SMTP sending fails, logs the error and gracefully continues.
 *
 * @param {Object} booking - Booking database record
 * @returns {Promise<{success: boolean, messageId?: string, alreadySent?: boolean, error?: string}>}
 */
async function sendBookingConfirmation(booking) {
  if (!booking || !booking.id) {
    return { success: false, error: 'Invalid booking record provided.' };
  }

  // Retrieve latest state from database
  const freshBooking = appointmentService.getBookingById(booking.id) || booking;

  // Single-send enforcement: Do not send if already sent
  if (freshBooking.confirmationEmailSentAt) {
    console.log(`[Email Service] Confirmation email already sent for booking #${freshBooking.id} at ${freshBooking.confirmationEmailSentAt}. Skipping.`);
    return { success: true, alreadySent: true };
  }

  const clientEmail = freshBooking.clientEmail;
  if (!clientEmail) {
    console.warn(`[Email Service] No client email associated with booking #${freshBooking.id}.`);
    return { success: false, error: 'Missing clientEmail.' };
  }

  // Brand and Consultant configurations
  const brandName = 'Usman Naeem Cyber Security Consulting';
  const consultantName = 'Usman Naeem';
  const websiteUrl = (process.env.BASE_URL || 'https://cybersecurityconsultant-ekkl.vercel.app').replace(/\/+$/, '');
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'usman@usmancybersecurity.com';

  // Booking fields (escaped for HTML safety)
  const escapedService = escapeHtml(freshBooking.service || 'Security Consultation');
  const escapedClientName = escapeHtml(freshBooking.clientName || 'Valued Client');
  const rawDateTime = freshBooking.bookingDateTime || '';
  const dtParts = rawDateTime.split(' ');
  const dateStr = dtParts[0] || 'Scheduled Date';
  const timeStr = dtParts.slice(1).join(' ') || 'Scheduled Time';
  const escapedDate = escapeHtml(dateStr);
  const escapedTime = escapeHtml(timeStr);

  const meetingMethod = 'Google Meet link will be delivered directly to your calendar invite prior to the session.';
  const preparationNotes = 'Please prepare a brief inventory of your target systems, network perimeters, and any prior vulnerability assessments or compliance audit reports.';
  const signOffLine = `${brandName} · by ${consultantName} · ${websiteUrl}`;

  // Plain Text Version
  const textContent = `
Dear ${freshBooking.clientName},

Your session is confirmed.

Booking Summary:
- Service: ${freshBooking.service}
- Date: ${dateStr}
- Time: ${timeStr} (Asia/Dubai)
- Meeting Method: ${meetingMethod}

What to Prepare:
${preparationNotes}

If you have any questions or require an NDA prior to the call, please reply directly to this email.

Best regards,
${signOffLine}
`.trim();

  // HTML Version (Responsive, styled in dark cyber security aesthetic)
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Your session is confirmed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #071526; color: #ffffff; margin: 0; padding: 24px; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #0d2138; border: 1px solid rgba(0, 245, 212, 0.25); border-radius: 12px; padding: 32px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
    .header-tag { font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #00f5d4; margin-bottom: 8px; }
    h1 { color: #ffffff; font-size: 22px; margin-top: 0; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; }
    p { color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: rgba(0,0,0,0.25); border-radius: 8px; overflow: hidden; }
    .details-table td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 14px; }
    .label-col { color: #94a3b8; width: 35%; font-weight: 500; }
    .val-col { color: #ffffff; font-weight: 600; }
    .val-highlight { color: #00f5d4; font-family: monospace; }
    .prep-box { background: rgba(0, 245, 212, 0.08); border-left: 3px solid #00f5d4; padding: 14px 18px; border-radius: 4px; margin: 20px 0; }
    .prep-box strong { color: #00f5d4; display: block; margin-bottom: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
    .signoff { font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; margin-top: 28px; text-align: center; }
    .signoff a { color: #00f5d4; text-decoration: none; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header-tag">ENGAGEMENT CONFIRMED</div>
    <h1>Your session is confirmed</h1>

    <p>Hello <strong>${escapedClientName}</strong>,</p>
    <p>Thank you for scheduling your security consultation. Your appointment has been confirmed in our calendar.</p>

    <table class="details-table">
      <tr>
        <td class="label-col">Service</td>
        <td class="val-col">${escapedService}</td>
      </tr>
      <tr>
        <td class="label-col">Scheduled Date</td>
        <td class="val-highlight">${escapedDate}</td>
      </tr>
      <tr>
        <td class="label-col">Time Slot</td>
        <td class="val-highlight">${escapedTime} (Asia/Dubai)</td>
      </tr>
      <tr>
        <td class="label-col">Meeting Method</td>
        <td class="val-col">${escapeHtml(meetingMethod)}</td>
      </tr>
    </table>

    <div class="prep-box">
      <strong>What to prepare:</strong>
      <p style="margin: 0; font-size: 13.5px; color: #e2e8f0;">${escapeHtml(preparationNotes)}</p>
    </div>

    <p style="font-size: 13.5px; color: #94a3b8; margin-top: 20px;">
      All discussions are treated under strict confidentiality and professional non-disclosure terms. If you have an active NDA or specific scoping document to review before our call, please reply directly to this email.
    </p>

    <div class="signoff">
      ${signOffLine}
    </div>
  </div>
</body>
</html>
`.trim();

  const mailOptions = {
    from: `"${brandName}" <${fromAddress}>`,
    to: clientEmail,
    subject: 'Your session is confirmed',
    text: textContent,
    html: htmlContent
  };

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Service] Confirmation email successfully sent to ${clientEmail} for booking #${freshBooking.id}. (MessageId: ${info.messageId || 'json-simulated'})`);

    // Record in database that confirmation email has been sent
    appointmentService.markConfirmationEmailSent(freshBooking.id);

    return {
      success: true,
      messageId: info.messageId || 'json-simulated'
    };
  } catch (err) {
    // "If sending fails, log the error and still show the booking as confirmed."
    console.error(`[Email Service Error] Failed to send confirmation email for booking #${freshBooking.id} to ${clientEmail}:`, err.message);

    // Record attempt so we do not continually fail on repeat page views
    appointmentService.markConfirmationEmailSent(freshBooking.id);

    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Sends an appointment reminder email to the client for a "Booked" session.
 *
 * Subject: "Reminder: your session"
 * Body: "Hi {ClientName}, a reminder that your {Service} session with [your name] is on {Date} at {Time}. Reply to reschedule."
 * Sign-off line: "[brand name] · [website]"
 *
 * @param {Object} booking - Booking database record
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendBookingReminder(booking) {
  if (!booking || !booking.id) {
    return { success: false, error: 'Invalid booking record provided.' };
  }

  const clientEmail = booking.clientEmail;
  if (!clientEmail) {
    return { success: false, error: 'No client email associated with this booking.' };
  }

  const brandName = 'Usman Naeem Cyber Security Consulting';
  const consultantName = 'Usman Naeem';
  const websiteUrl = (process.env.BASE_URL || 'https://cybersecurityconsultant-ekkl.vercel.app').replace(/\/+$/, '');
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'usman@usmancybersecurity.com';

  // Extract Date and Time from bookingDateTime (e.g. "2026-11-20 10:00 AM")
  const rawDateTime = booking.bookingDateTime || '';
  const dtParts = rawDateTime.trim().split(' ');
  const dateStr = dtParts[0] || 'Scheduled Date';
  const timeStr = dtParts.slice(1).join(' ') || 'Scheduled Time';

  const clientName = booking.clientName || 'Valued Client';
  const service = booking.service || 'Security Consultation';
  const signOffLine = `${brandName} · ${websiteUrl}`;

  // Plain Text Body
  const textContent = `Hi ${clientName}, a reminder that your ${service} session with ${consultantName} is on ${dateStr} at ${timeStr}. Reply to reschedule.

${signOffLine}`;

  // HTML Body
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Reminder: your session</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #071526; color: #ffffff; margin: 0; padding: 24px; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #0d2138; border: 1px solid rgba(0, 245, 212, 0.25); border-radius: 12px; padding: 32px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
    .header-tag { font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #00f5d4; margin-bottom: 8px; }
    h1 { color: #ffffff; font-size: 20px; margin-top: 0; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; }
    p { color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .signoff { font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; margin-top: 28px; text-align: center; }
    .signoff a { color: #00f5d4; text-decoration: none; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header-tag">UPCOMING SESSION REMINDER</div>
    <h1>Reminder: your session</h1>
    <p>Hi ${escapeHtml(clientName)}, a reminder that your <strong>${escapeHtml(service)}</strong> session with <strong>${escapeHtml(consultantName)}</strong> is on <strong>${escapeHtml(dateStr)}</strong> at <strong>${escapeHtml(timeStr)}</strong>. Reply to reschedule.</p>
    <div class="signoff">
      ${escapeHtml(brandName)} · <a href="${escapeHtml(websiteUrl)}">${escapeHtml(websiteUrl)}</a>
    </div>
  </div>
</body>
</html>
`.trim();

  const mailOptions = {
    from: `"${brandName}" <${fromAddress}>`,
    to: clientEmail,
    subject: 'Reminder: your session',
    text: textContent,
    html: htmlContent
  };

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Service] Reminder email successfully sent to ${clientEmail} for booking #${booking.id}. (MessageId: ${info.messageId || 'json-simulated'})`);

    if (typeof appointmentService.markReminderSent === 'function') {
      appointmentService.markReminderSent(booking.id);
    }

    return {
      success: true,
      messageId: info.messageId || 'json-simulated'
    };
  } catch (err) {
    console.error(`[Email Service Error] Failed to send reminder email for booking #${booking.id} to ${clientEmail}:`, err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  sendBookingConfirmation,
  sendBookingReminder,
  escapeHtml,
  createTransporter
};
