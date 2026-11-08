'use strict';

// Run with: npm test   (no real SMTP needed: sendMail is stubbed)
Object.assign(process.env, {
  SMTP_HOST: 'localhost', SMTP_PORT: '587', SMTP_USER: 'u', SMTP_PASS: 'p',
  MAIL_FROM: 'site@example.com', MAIL_TO: 'inbox@example.com', RATE_LIMIT_MAX: '3',
});

const test = require('node:test');
const assert = require('node:assert');
const { app, transporter } = require('./server');

const sent = [];
transporter.sendMail = async (msg) => { sent.push(msg); };

const valid = { name: 'Ada', email: 'ada@example.com', service: 'Web Design', details: 'Hi' };

test('contact endpoint', async (t) => {
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}/api/contact`;
  const post = (body, raw) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw || JSON.stringify(body) });
  t.after(() => server.close());

  await t.test('rejects a bad email', async () => {
    assert.strictEqual((await post({ ...valid, email: 'nope' })).status, 400);
  });

  await t.test('strips line breaks from header fields', async () => {
    const r = await post({ ...valid, name: 'Ada\r\nBcc: victim@example.com' });
    assert.strictEqual(r.status, 200);
    assert.ok(!/[\r\n]/.test(sent.at(-1).subject));
  });

  await t.test('honeypot pretends success without sending', async () => {
    const before = sent.length;
    const r = await post({ ...valid, website: 'spam.example' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(sent.length, before);
  });

  await t.test('malformed JSON gets a JSON 400, no stack trace', async () => {
    const r = await post(null, '{bad');
    assert.strictEqual(r.status, 400);
    assert.deepStrictEqual(await r.json(), { ok: false, error: 'Bad request' });
  });

  await t.test('rate limits after RATE_LIMIT_MAX requests', async () => {
    assert.strictEqual((await post(valid)).status, 429);
  });
});
