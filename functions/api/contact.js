/**
 * Cloudflare Pages Function: POST /api/contact → lib/contact.js, delivered through the Resend API.
 * Secrets (Pages project → Settings → Variables and secrets): RESEND_API_KEY (required; Resend account made with the
 * MAIL_TO address), MAIL_TO (default atrilemma@gmail.com), MAIL_FROM (default Resend's test sender),
 * TURNSTILE_SECRET_KEY (optional).
 * No npm dependencies on purpose: the Git build has no build command, so node_modules is not installed.
 * The Vercel deployment uses api/contact.js (Nodemailer + Gmail) instead.
 */
import { handleContact } from '../../lib/contact.js';

function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function onRequestPost({ request, env }) {
  return handleContact(request, env, async (m) => {
    if (!env.RESEND_API_KEY) return null;
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
  });
}
