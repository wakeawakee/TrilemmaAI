/**
 * Cloudflare Pages Function: POST /api/contact → lib/contact.js.
 * Sends with Gmail SMTP (worker-mailer; Nodemailer cannot run on Cloudflare) when GMAIL_APP_PASSWORD is set,
 * otherwise with Resend when RESEND_API_KEY is set, otherwise answers 503.
 * Secrets (`npx wrangler pages secret put NAME --project-name <project>`):
 *   GMAIL_APP_PASSWORD  16-letter Google App Password of GMAIL_USER (default atrilemma@gmail.com)
 *   RESEND_API_KEY      alternative sender; MAIL_FROM optional
 *   MAIL_TO             optional, default atrilemma@gmail.com; TURNSTILE_SECRET_KEY optional
 * The Vercel deployment uses api/contact.js (Nodemailer + Gmail) instead.
 */
import { handleContact } from '../../lib/contact.js';

function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function viaGmail(env, m) {
  // dynamic: worker-mailer needs cloudflare:sockets, so loading it lazily keeps this file importable in Node tests
  const { WorkerMailer } = await import('worker-mailer');
  const user = env.GMAIL_USER || 'atrilemma@gmail.com';
  const mailer = await WorkerMailer.connect({
    host: 'smtp.gmail.com', port: 465, secure: true,
    credentials: { username: user, password: env.GMAIL_APP_PASSWORD.replace(/\s+/g, '') }, // shown as "abcd efgh ijkl mnop"
    authType: 'plain',
  });
  try {
    await mailer.send({
      from: { name: 'Trilemma Website', email: user },
      to: { email: m.to }, reply: { email: m.replyTo },
      subject: m.subject, text: m.text, html: m.html,
      attachments: m.attachment && [{ filename: m.attachment.filename, content: toBase64(m.attachment.bytes), mimeType: m.attachment.mime }],
    });
  } finally {
    await mailer.close().catch(() => {});
  }
  return true;
}

async function viaResend(env, m) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Trilemma Website <onboarding@resend.dev>',
      to: [m.to], reply_to: m.replyTo, subject: m.subject, text: m.text, html: m.html,
      attachments: m.attachment && [{ filename: m.attachment.filename, content: toBase64(m.attachment.bytes), content_type: m.attachment.mime }],
    }),
  });
  if (!res.ok) console.error('Resend failed', res.status, await res.text().catch(() => ''));
  return res.ok;
}

export function onRequestPost({ request, env }) {
  return handleContact(request, env, (m) => {
    if (env.GMAIL_APP_PASSWORD) return viaGmail(env, m);
    if (env.RESEND_API_KEY) return viaResend(env, m);
    return null;
  });
}
