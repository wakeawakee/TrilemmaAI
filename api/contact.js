/**
 * Vercel Function: POST /api/contact → lib/contact.js, delivered with Nodemailer through Gmail SMTP.
 * Environment variables (Vercel → Project → Settings → Environment Variables):
 *   GMAIL_APP_PASSWORD  required. 16-letter Google App Password of GMAIL_USER (myaccount.google.com/apppasswords)
 *   GMAIL_USER          optional, default atrilemma@gmail.com (the account that sends)
 *   MAIL_TO             optional, default atrilemma@gmail.com (where enquiries and CVs arrive)
 *   TURNSTILE_SECRET_KEY optional
 */
import nodemailer from 'nodemailer';
import { handleContact } from '../lib/contact.js';

export function POST(request) {
  const env = process.env;
  return handleContact(request, env, async (m) => {
    if (!env.GMAIL_APP_PASSWORD) return null;
    const user = env.GMAIL_USER || 'atrilemma@gmail.com';
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass: env.GMAIL_APP_PASSWORD.replace(/\s+/g, '') }, // Google shows it as "abcd efgh ijkl mnop"
    });
    await transporter.sendMail({
      from: `"Trilemma Website" <${user}>`,
      to: m.to, replyTo: m.replyTo, subject: m.subject, text: m.text, html: m.html,
      attachments: m.attachment && [{ filename: m.attachment.filename, content: Buffer.from(m.attachment.bytes), contentType: m.attachment.mime }],
    });
    return true;
  });
}
