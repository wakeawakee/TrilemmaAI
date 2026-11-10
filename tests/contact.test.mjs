// node --test tests/   (checks functions/api/contact.js with the Resend API stubbed)
import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/contact.js';

const env = { RESEND_API_KEY: 're_test' };
let sent;
globalThis.fetch = async (url, opts) => {
  sent = { url, body: opts.body instanceof FormData ? opts.body : JSON.parse(opts.body) };
  return new Response(url.includes('formsubmit') ? '{"success":"true"}' : '{}', { status: 200 });
};

function post(fields, extraHeaders = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const request = new Request('https://site.test/api/contact', { method: 'POST', body: fd, headers: { Origin: 'https://site.test', ...extraHeaders } });
  sent = null;
  return onRequestPost({ request, env }).then(async (r) => ({ status: r.status, body: await r.json() }));
}
const pdf = (size = 100) => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, ...new Array(size).fill(65)])], 'my cv.pdf', { type: 'application/pdf' });

test('enquiry is emailed to atrilemma@gmail.com with reply-to the visitor', async () => {
  const r = await post({ name: 'Asha', email: 'asha@example.com', service: 'Web Design', details: 'Need a site' });
  assert.equal(r.status, 200);
  assert.deepEqual(sent.body.to, ['atrilemma@gmail.com']);
  assert.equal(sent.body.reply_to, 'asha@example.com');
  assert.match(sent.body.subject, /New enquiry: Web Design from Asha/);
  assert.equal(sent.body.attachments, undefined);
});

test('CV is attached to the email', async () => {
  const r = await post({ kind: 'cv', name: 'Ram K', email: 'ram@example.com', area: 'Security', cv: pdf() });
  assert.equal(r.status, 200);
  const [a] = sent.body.attachments;
  assert.equal(a.filename, 'CV-Ram-K.pdf');
  assert.equal(a.content_type, 'application/pdf');
  assert.equal(atob(a.content).slice(0, 4), '%PDF');
  assert.match(sent.body.subject, /CV: Ram K \(Security\)/);
});

test('rejects a fake PDF, a missing CV and an oversized CV without sending', async () => {
  const fake = new File(['MZ not a pdf'], 'cv.pdf');
  for (const cv of [fake, '', pdf(5 * 1024 * 1024)]) {
    const r = await post({ kind: 'cv', name: 'X', email: 'x@example.com', cv });
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.equal(sent, null);
  }
});

test('rejects bad email, header injection stays on one line, honeypot fakes success', async () => {
  assert.equal((await post({ name: 'A', email: 'nope', service: 's', details: 'd' })).status, 400);
  await post({ name: 'A\r\nBcc: evil@x.com', email: 'a@example.com', service: 's', details: 'd' });
  assert.doesNotMatch(sent.body.subject, /[\r\n]/);
  const hp = await post({ name: 'A', email: 'a@example.com', service: 's', details: 'd', website: 'spam' });
  assert.equal(hp.status, 200);
  assert.equal(sent, null);
});

test('blocks other origins', async () => {
  assert.equal((await post({ name: 'A', email: 'a@example.com', service: 's', details: 'd' }, { Origin: 'https://evil.test' })).status, 403);
});

test('Vercel handler: no GMAIL_APP_PASSWORD → 503, nothing sent', async () => {
  const { POST } = await import('../api/contact.js');
  delete process.env.GMAIL_APP_PASSWORD;
  const fd = new FormData();
  Object.entries({ name: 'A', email: 'a@example.com', service: 's', details: 'd' }).forEach(([k, v]) => fd.append(k, v));
  const r = await POST(new Request('https://site.test/api/contact', { method: 'POST', body: fd }));
  assert.equal(r.status, 503);
});

test('shared handler passes the CV bytes and reply-to to the mailer; mailer errors → 502', async () => {
  const { handleContact } = await import('../lib/contact.js');
  const req = () => {
    const fd = new FormData();
    Object.entries({ kind: 'cv', name: 'Sita', email: 'sita@example.com' }).forEach(([k, v]) => fd.append(k, v));
    fd.append('cv', pdf(10));
    return new Request('https://site.test/api/contact', { method: 'POST', body: fd });
  };
  let msg;
  const ok = await handleContact(req(), {}, async (m) => { msg = m; return true; });
  assert.equal(ok.status, 200);
  assert.equal(msg.to, 'atrilemma@gmail.com');
  assert.equal(msg.replyTo, 'sita@example.com');
  assert.equal(msg.attachment.filename, 'CV-Sita.pdf');
  assert.equal(new TextDecoder().decode(msg.attachment.bytes.slice(0, 4)), '%PDF');
  const fail = await handleContact(req(), {}, async () => { throw new Error('SMTP down'); });
  assert.equal(fail.status, 502);
});

test('middleware: redirects pages.dev and www to the canonical domain only when CANONICAL_HOST is set', async () => {
  const { onRequest } = await import('../functions/_middleware.js');
  const run = (url, env) => onRequest({ request: new Request(url), env, next: () => new Response('site') });
  assert.equal(await (await run('https://trilemma-tech-innovation.pages.dev/', {})).text(), 'site');
  const r = await run('https://abc123.tts-studio-5ew.pages.dev/assets/x.png?v=2', { CANONICAL_HOST: 'trilemmai.com' });
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('Location'), 'https://trilemmai.com/assets/x.png?v=2');
  assert.equal((await run('https://www.trilemmai.com/#x', { CANONICAL_HOST: 'trilemmai.com' })).status, 301);
  assert.equal(await (await run('https://trilemmai.com/', { CANONICAL_HOST: 'trilemmai.com' })).text(), 'site');
});
