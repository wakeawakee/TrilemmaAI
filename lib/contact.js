/**
 * Shared handler for POST /api/contact: the enquiry form and the careers CV form
 * (multipart/form-data, field `kind` = 'enquiry' | 'cv'). Validates everything, then hands one message to `deliver`.
 * Used by api/contact.js (Vercel, Nodemailer + Gmail) and functions/api/contact.js (Cloudflare Pages, Resend).
 *
 * deliver(msg) gets { to, replyTo, subject, text, html, attachment?: { filename, bytes: Uint8Array, mime } }
 * and must resolve truthy when the mail was accepted. Returning `null` means "not configured" (→ 503).
 */

// 4 MB: Vercel functions reject request bodies over 4.5 MB.
export const MAX_CV_BYTES = 4 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_CV_BYTES + 256 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// extension → expected leading bytes: PDF "%PDF", DOCX (zip) "PK", legacy DOC (OLE2) D0 CF 11 E0
const CV_TYPES = {
  pdf: { magic: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf' },
  docx: { magic: [0x50, 0x4b], mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  doc: { magic: [0xd0, 0xcf, 0x11, 0xe0], mime: 'application/msword' },
};

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const clean = (v, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const line = (v, max) => clean(v, max).replace(/[\r\n]+/g, ' '); // single-line: these go into mail headers
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function turnstileOk(secret, token, ip) {
  if (!secret) return true;
  if (!token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    return (await r.json()).success === true;
  } catch {
    return false;
  }
}

function mailBody(title, rows, longLabel, longText, replyName) {
  const when = new Date().toISOString();
  const text = [title, '', ...rows.map(([k, v]) => `${k}: ${v || '-'}`), '', `${longLabel}:`, longText || '-', '', `Submitted: ${when}`].join('\n');
  const cell = 'padding:8px 12px;border:1px solid #ddd';
  const html = `<h2 style="font-family:Arial,sans-serif">${esc(title)}</h2>
<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${rows.map(([k, v]) => `<tr><td style="${cell};font-weight:600">${esc(k)}</td><td style="${cell}">${esc(v || '-')}</td></tr>`).join('')}</table>
<h3 style="font-family:Arial,sans-serif;margin-top:20px">${esc(longLabel)}</h3>
<p style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${esc(longText || '-')}</p>
<p style="font-family:Arial,sans-serif;font-size:12px;color:#777">Submitted ${esc(when)}. Reply to this email to answer ${esc(replyName)} directly.</p>`;
  return { text, html };
}

export async function handleContact(request, env, deliver) {
  // Only our own pages may post here (blocks other sites' scripts from using this as a mail relay).
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json(403, { ok: false, error: 'Forbidden' });
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) return json(413, { ok: false, error: 'The upload is too large (max 4 MB).' });

  let form;
  try {
    form = await request.formData();
  } catch {
    return json(400, { ok: false, error: 'Bad request' });
  }
  const get = (k) => form.get(k);

  // Honeypot: real visitors never see this field. Pretend success so bots learn nothing.
  if (clean(get('website'))) return json(200, { ok: true });

  const kind = get('kind') === 'cv' ? 'cv' : 'enquiry';
  const name = line(get('name'), 200);
  const email = line(get('email'), 320);
  const errors = [];
  if (!name) errors.push('name is required');
  if (!EMAIL_RE.test(email)) errors.push('a valid email is required');

  let subject, title, rows, long, attachment;
  if (kind === 'enquiry') {
    const company = line(get('company'), 200);
    const service = line(get('service'), 300);
    const details = clean(get('details'), 8000);
    if (!service) errors.push('service is required');
    if (!details) errors.push('details are required');
    subject = `[Website] New enquiry: ${service} from ${name}`;
    title = 'New enquiry from the website';
    rows = [['Name', name], ['Email', email], ['Company', company], ['Service', service]];
    long = ['Project details', details];
  } else {
    const area = line(get('area'), 200);
    const link = line(get('link'), 500);
    const note = clean(get('message'), 4000);
    const cv = get('cv');
    if (!cv || typeof cv === 'string' || !cv.size) errors.push('please attach your CV');
    else {
      const ext = (cv.name.split('.').pop() || '').toLowerCase();
      const type = CV_TYPES[ext];
      const bytes = new Uint8Array(await cv.arrayBuffer());
      if (bytes.length > MAX_CV_BYTES) errors.push('the CV must be 4 MB or smaller');
      else if (!type || !type.magic.every((b, i) => bytes[i] === b)) errors.push('the CV must be a PDF, DOC or DOCX file');
      else attachment = { filename: `CV-${name.replace(/[^\w.-]+/g, '-').slice(0, 60)}.${ext}`, bytes, mime: type.mime };
    }
    subject = `[Website] CV: ${name}${area ? ` (${area})` : ''}`;
    title = 'New CV from the careers form';
    rows = [['Name', name], ['Email', email], ['Area', area], ['Portfolio / link', link], ['CV file', attachment && attachment.filename]];
    long = ['Message', note];
  }

  if (errors.length) return json(400, { ok: false, error: errors.join('; ') });

  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '';
  if (!(await turnstileOk(env.TURNSTILE_SECRET_KEY, clean(get('cf-turnstile-response'), 2048), ip))) {
    return json(403, { ok: false, error: 'Bot check failed. Please reload the page and try again.' });
  }

  // shortcut: no per-IP rate limit (serverless, no shared state); add the host's rate-limit / firewall rule on
  // /api/contact, or Turnstile, if spam shows up.
  const body = mailBody(title, rows, long[0], long[1], name);
  let sent;
  try {
    sent = await deliver({ to: env.MAIL_TO || 'atrilemma@gmail.com', replyTo: email, subject, text: body.text, html: body.html, attachment });
  } catch (err) {
    console.error('Mail delivery failed:', err && err.message);
    sent = false;
  }
  if (sent === null) return json(503, { ok: false, error: 'Email is not configured yet.' });
  if (!sent) return json(502, { ok: false, error: 'The message could not be sent. Please try again later.' });
  return json(200, { ok: true });
}
