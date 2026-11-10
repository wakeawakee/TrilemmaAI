# Trilemma website

- `site/` — the static website. Open `site/index.html`, or serve the folder (`npx serve site`).
  Edit content (contact details, socials, services) in `site/js/config.js` only.
- `backend/` — contact form API (`POST /api/contact`). See `backend/README.md`.
- `AGENTS.md` — architecture, rules and current status (read before changing anything).

Deploy the site with Cloudflare Pages: no build command, output directory `site`.
