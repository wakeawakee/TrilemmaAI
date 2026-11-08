# Contact form — backend setup

The website's contact form POSTs JSON to `/api/contact`
(configured in one place in `site/js/config.js`: `contactEndpoint`).
This folder is the ready-to-deploy backend for that endpoint.

## Files

- `server.js` — Node.js + Express + Nodemailer endpoint.
- `package.json` — dependencies and start script.
- `.env.example` — every setting the backend reads (also saved
  as `env.example` so it stays visible in listings that hide
  dotfiles).

## Deploy in 4 steps

1. Copy this whole `backend` folder to your server, next to
   (not inside) your static site files.
2. Create your env file and fill in your SMTP details:

   ```bash
   cp .env.example .env
   # edit .env — SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER,
   # SMTP_PASS, MAIL_FROM, MAIL_TO, optional MAIL_SUBJECT_PREFIX
   ```

3. Install and run:

   ```bash
   npm install
   npm start        # listens on PORT (default 3000)
   ```

4. Make `/api/contact` reach it: either serve the static site
   from the same host and reverse-proxy `/api/contact` to
   `http://localhost:3000/api/contact`, or set
   `contactEndpoint` in `site/js/config.js` to the backend's
   full URL.

## Behaviour

- Validates name, email, service and project details; strips line
  breaks from fields that go into mail headers.
- Rate limit: 5 enquiries per IP per 10 minutes (`RATE_LIMIT_MAX`).
  Set `TRUST_PROXY=1` behind Cloudflare/nginx so it sees real IPs.
- Honeypot field `website`: bots that fill it get a fake success.
- Optional Cloudflare Turnstile: set `TURNSTILE_SECRET_KEY` here and
  `turnstileSiteKey` in `site/js/config.js`.
- Optional CORS: set `ALLOWED_ORIGIN` only if the site and API are on
  different origins (also add the API to `connect-src` in `site/_headers`).
- Returns JSON `{ "ok": true }`, or `{ "ok": false, "error": "…" }`
  with 400/403/429/502. Never returns stack traces.
- Secrets come from environment variables only.

## Tests

    npm test     # stubs SMTP; checks validation, header stripping, honeypot, rate limit
