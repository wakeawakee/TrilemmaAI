/**
 * Contact form backend
 * ====================
 * Receives POST /api/contact from the website contact form and
 * sends it as an email via SMTP (Nodemailer).
 *
 * Setup:
 *   1. Copy .env.example to .env and fill in your SMTP details.
 *   2. npm install
 *   3. npm start            (listens on PORT, default 3000)
 *
 * All secrets are read from environment variables only.
 */

'use strict';

require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');

/* ---- Config: environment variables only ---- */
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  MAIL_TO,
  MAIL_SUBJECT_PREFIX,
  ALLOWED_ORIGIN,         // only needed when the site is on a different origin than this API
  TURNSTILE_SECRET_KEY,   // optional Cloudflare Turnstile secret; enables bot checks when set
  TRUST_PROXY,            // e.g. "1" behind Cloudflare/nginx so req.ip is the visitor's IP
} = process.env;

const PORT = parseInt(process.env.PORT || '3000', 10);
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '5', 10);
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const missing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'MAIL_TO']
  .filter((key) => !process.env[key]);
if (missing.length) {
  console.error('Missing required environment variables: ' + missing.join(', '));
  console.error('Copy .env.example to .env and fill in your SMTP details.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: parseInt(SMTP_PORT, 10),
  secure: String(SMTP_SECURE).toLowerCase() === 'true', // true for port 465, false for 587/25
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

const app = express();
app.disable('x-powered-by');
if (TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(TRUST_PROXY) ? parseInt(TRUST_PROXY, 10) : TRUST_PROXY);

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'no-store');
  if (ALLOWED_ORIGIN && req.headers.origin === ALLOWED_ORIGIN) {
    res.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '64kb' }));

/* ---- Helpers ---- */
function clean(value, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

// Single-line fields end up in mail headers (subject, reply-to): strip line breaks.
function line(value, max) {
  return clean(value, max).replace(/[\r\n]+/g, ' ');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// shortcut: in-memory per-IP limiter, resets on restart and is per-process; move to Cloudflare rate limiting rules or Redis if you run several instances.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.reset) {
    hits.set(ip, { count: 1, reset: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) if (now > entry.reset) hits.delete(ip);
}, RATE_LIMIT_WINDOW_MS).unref();

async function turnstileOk(token, ip) {
  if (!TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
    });
    const data = await r.json();
    return data.success === true;
  } catch (err) {
    console.error('Turnstile verification failed:', err);
    return false;
  }
}

/* ---- Endpoint the website form POSTs to ---- */
app.post('/api/contact', async (req, res) => {
  if (rateLimited(req.ip)) {
    return res.status(429).json({ ok: false, error: 'Too many requests. Please try again later.' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  // Honeypot: real visitors never see this field. Pretend success so bots learn nothing.
  if (clean(body.website)) return res.json({ ok: true });

  const fields = {
    name: line(body.name, 200),
    company: line(body.company, 200),
    email: line(body.email, 320),
    phone: line(body.phone, 60),
    service: line(body.service, 300),
    details: clean(body.details || body.message, 8000),
  };

  const errors = [];
  if (!fields.name) errors.push('name is required');
  if (!fields.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.push('a valid email is required');
  }
  if (!fields.service) errors.push('service is required');
  if (!fields.details) errors.push('details are required');

  if (errors.length) {
    return res.status(400).json({ ok: false, error: errors.join('; ') });
  }

  if (!(await turnstileOk(clean(body['cf-turnstile-response'], 2048), req.ip))) {
    return res.status(403).json({ ok: false, error: 'Bot check failed. Please reload the page and try again.' });
  }

  const prefix = (MAIL_SUBJECT_PREFIX || '[Website]').trim();
  const subject = `${prefix} New enquiry: ${fields.service} from ${fields.name}`;

  const text = [
    'New enquiry from the website',
    '============================',
    '',
    `Name:            ${fields.name}`,
    `Company:         ${fields.company || '-'}`,
    `Email:           ${fields.email}`,
    `Contact number:  ${fields.phone || '-'}`,
    `Service:         ${fields.service}`,
    '',
    'Project details:',
    '----------------',
    fields.details,
    '',
    `Submitted: ${new Date().toISOString()}`,
  ].join('\n');

  const rows = [
    ['Name', fields.name],
    ['Company', fields.company || '-'],
    ['Email', fields.email],
    ['Contact number', fields.phone || '-'],
    ['Service', fields.service],
  ]
    .map(([k, v]) => `<tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:600">${k}</td><td style="padding:8px 12px;border:1px solid #ddd">${escapeHtml(v)}</td></tr>`)
    .join('');

  const html = `
    <h2 style="font-family:Arial,sans-serif">New enquiry from the website</h2>
    <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${rows}</table>
    <h3 style="font-family:Arial,sans-serif;margin-top:20px">Project details</h3>
    <p style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${escapeHtml(fields.details)}</p>
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#777">Submitted ${escapeHtml(new Date().toISOString())}. Reply directly to this email to answer ${escapeHtml(fields.name)}.</p>`;

  try {
    await transporter.sendMail({
      from: MAIL_FROM,
      to: MAIL_TO,
      replyTo: fields.email,
      subject,
      text,
      html,
    });
    return res.json({ ok: true, message: 'Enquiry sent.' });
  } catch (err) {
    console.error('Failed to send contact email:', err);
    return res.status(502).json({ ok: false, error: 'Mail server could not send the enquiry. Please try again later.' });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Malformed JSON and other errors: short JSON reply, never a stack trace.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status && err.status < 500 ? err.status : 500;
  res.status(status).json({ ok: false, error: status === 500 ? 'Server error' : 'Bad request' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Contact backend listening on port ${PORT} (POST /api/contact)`);
  });
}

module.exports = { app, transporter };
