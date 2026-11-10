# AGENTS.md — Trilemma agency website

Read this first. It is the handoff between agent sessions (desktop VS Code and phone via Claude remote control).
Keep it current: when you finish a chunk of work, update **Status** and **Session log**.

## Goal

The agency's public website. It must feel like a premium, established studio:
- clean, editorial, dark layout with one accent colour (violet `#a495ff`)
- **scroll-based motion with one clear repeating pattern**, restrained, never flashy
- a logo intro (preloader) before the page opens

Inspired by https://samatra.com/ (pinned hero that swaps statements on scroll, left progress "meter", eyebrow labels)
and https://rpjdesign.com.au/ (serif-italic accent words, active-item services list, stacking process cards).
Studied with REA on 2026-11-01. Their code, assets and copy are **not** copied.

## Brand

- Emblem: three overlapping violet circles (AI · Cybersecurity · Software, the three domains) with nothing in the
  centre (no letters). Used for the preloader, nav logo and footer.
  Source: `<symbol id="tti-mark">` in `site/index.html` (viewBox `13 10.5 102 98`); standalone `site/assets/logo.svg`.
- CSS/JS are served `max-age=0, must-revalidate` (see `_headers`) so deploys show immediately. A stale 1-day cache once
  hid the new hamburger on the user's phone.
- Favicon (`site/assets/favicon.svg`): 3-circle Venn (AI · Cybersecurity · Software, the three domains) (no letter). Bump `?v=` on its `<link>` in index.html when it changes (assets are cached 7 days).
- Brand name: **Trilemma** (user renamed it on 2026-11-10 from "Trilemma Tech Innovation / TTI", earlier
  "Trilemma Tech Studio / TTS"; keep it consistent everywhere). Set in `site/js/config.js` → `brand.name`;
  shown under the mark in the nav (`.brand-name`), footer name, footer legal line, page title and og:title.
  The giant footer wordmark stays "Trilemma AI" (`footerWordmark`, separate user choice).
  Emblem has NO letter (2026-11-10, user: remove the T): just the three circles. Same in the index.html symbol,
  favicon.svg (v=7), logo.svg and assets/brand/logo.svg; brand PNGs re-rendered (dark/light variants now identical).
  History: TTI letters → single T → no letter.
- Studio statement (user-directed wording, keep): "We are innovators and engineers who build. For every project we
  assemble the specialists it actually needs, engineers, security testers, AI integration and automation experts, and
  we stay accountable from the first call to the final handover." Do not call the studio "small".
- Hero (user-supplied, keep verbatim): "Engineering ambitious ideas into reality." /
  "An independent technology studio specializing in AI, cybersecurity, and software engineering. We bring together experienced specialists based on each project's requirements."
- Fonts (Google Fonts): Inter Tight (sans), Instrument Serif italic (accent words), JetBrains Mono (labels).

## Services (current list; the user will refine later)

Web App Development · Web Design · App Development · AI Integration · Custom Chatbots · Penetration Testing · Vulnerability Assessment
Edit in `site/js/config.js` → `services` (group, name, summary, tags). Rendered automatically, also fills the form's service dropdown.

## Pending from the user

- Social links → **only** `site/js/config.js` (`socials`). Empty values stay hidden. Set 2026-11-08: email
  `atrilemma@gmail.com`, phone `+977 9848210450`, address `Jhamsikhel, Lalitpur`, website (pages.dev URL until a domain).
  Contact items render into the footer "Contact" column only (`[data-contact]`). The user does NOT want them repeated
  in the "Tell us what you're building" contact section: that section is heading, text and form only.
- Final service wording → `site/js/config.js` → `services`.
- **Forms WORK (2026-11-08)** on both Pages projects via Resend (`RESEND_API_KEY` secret set; account made with
  atrilemma@gmail.com; sender `onboarding@resend.dev`, which only delivers to that address). Google refused to create
  a Gmail App Password ("couldn't verify it's you"), so the Gmail path (`GMAIL_APP_PASSWORD`) is unused for now.
  With a custom domain: verify it in Resend and set `MAIL_FROM` (e.g. website@domain) so mail stops looking like a test.
  Vercel not needed (no projects there). GitHub: pushed to master (github.com/wakeawakee/TrilemmaAI), 2026-11-10.
- Custom domain **trilemmai.com** (bought by the user on Cloudflare, 2026-11-10). config `website` already set to it.
  Steps left: user adds trilemmai.com + www.trilemmai.com under the Pages project → Custom domains; once it serves,
  set secret `CANONICAL_HOST=www.trilemmai.com` (user chose www as the main address, 2026-11-10) on the Pages project and redeploy → `functions/_middleware.js` 301s every
  other host (*.pages.dev incl. old deployment links, tts-studio, www) to https://trilemmai.com. Then: verify the domain
  in Resend and set `MAIL_FROM`, DNSSEC, Turnstile, WAF rate limit on /api/contact, rotate the Resend key (pasted in chat).

## Architecture

```
site/                 ← the ONLY folder that gets published (Cloudflare Pages output dir)
  index.html          markup; sections: hero, studio, services, process, approach, careers, contact, footer
  css/style.css       tokens in :root, layout, motion, reduced-motion fallback
  js/config.js        ALL editable content (brand, contact, socials, services, endpoint, Turnstile key)
  js/script.js        renders config, preloader, nav/menu, scroll scenes, reveals, enquiry + CV forms, CV success <dialog>
  assets/             logo.svg, favicon.svg
  assets/brand/       social-media downloads (profile 1080, transparent logos, LinkedIn/X banners), rendered from logo.svg
  _headers            Cloudflare Pages security headers (CSP, HSTS, frame-ancestors, etc.)
  robots.txt          allows all crawlers incl. AI bots, blocks /api/, points to the sitemap
  sitemap.xml         one URL: https://www.trilemmai.com/ (submit in Google Search Console; bump lastmod on big changes)
  llms.txt            plain-text summary for AI assistants (GEO/AEO); keep services in sync with config.js
  assets/og-image.png 1200x630 social share image
lib/contact.js        SHARED form handler: multipart POST, `kind`=enquiry|cv, validation, CV (PDF/DOC/DOCX, ≤4 MB because
                      Vercel caps bodies at 4.5 MB, magic-byte checked), same-origin check, honeypot, optional Turnstile;
                      hands one message to a `deliver` callback. To: MAIL_TO (default atrilemma@gmail.com), reply-to sender.
api/contact.js        Vercel Function → lib/contact.js, Nodemailer + Gmail SMTP. Env: GMAIL_APP_PASSWORD (required),
                      GMAIL_USER, MAIL_TO. vercel.json = output dir `site` + the same headers as site/_headers.
functions/api/contact.js  Cloudflare Pages Function → lib/contact.js, Resend (RESEND_API_KEY secret). Must stay free of npm
                      dependencies: the Git build has no build command, so node_modules is not installed (a worker-mailer
                      import broke the first Git build on 2026-11-10 and was removed).
functions/_middleware.js  canonical-host redirect, active only when CANONICAL_HOST is set (see Pending).
tests/contact.test.mjs    `npm test` (mailers stubbed). Never put tests inside functions/ or api/.
backend/              OLD Express + Nodemailer version, not deployed; superseded (never inside site/)
  server.js           validation, rate limit, honeypot, header-injection stripping, optional Turnstile + CORS
  test.js             `npm test` (SMTP stubbed)
```

Motion system (keep it to this, do not add new effect types):
1. **Preloader**: the T mark draws itself, counter 000→100, panel slides up (~1.6 s). CSS fallback hides it at 4 s if JS fails.
2. **Pinned scenes** (`[data-scene]`): JS sets `--p` (0→1) while the section is pinned; CSS maps it to opacity/transform.
   Hero: headline tilts away in 3D and fades, the background grid tilts back into a 3D floor (CSS perspective),
   "AI. Cybersecurity. Software." stands up into place. Studio: words light up one by one.
   **Hero video (samatra-style)**: set `heroVideo` in config.js (e.g. `assets/hero.mp4`). The clip is fetched as a blob
   and its playhead is scrubbed by scroll (eased), hero grows to 500vh (400vh mobile), grid hides. Empty = 3D grid.
   samatra.com does this with a ~10 s cinematic clip (user says made with Higgsfield). Encode with `-g 6` (command in config.js).
3. **Reveal pattern** (`[data-reveal]`): heading lines rise out of a mask, content fades up. Same everywhere.
4. **Services**: row nearest the screen middle becomes active (accent number, brighter text).
5. **Process**: CSS-only sticky stacking cards.
6. **Left rail** (desktop >1280px): section index + name + scroll progress.
7. **Hero graphic** (`.hero-art`, ≥1100px only): inline SVG Venn of the three domains (AI neural nodes, Security radar
   sweep, Software `</>` + caret), orbiting dots, slow tick ring, centre pulse. CSS keyframes only (`ha-*`), sized
   `min(32vw, 540px)` so it never touches the headline (checked 1100–2560px). Reduced motion stops it.
8. **Footer wordmark** (`.footer-word`, securitypalhq.com-style): giant "Trilemma AI" (user-chosen text, config
   `footerWordmark`) spanning the content width (`20.4cqi`), white→violet gradient fill over a violet horizon glow.
   0.4 s after it scrolls into view (user found 2 s too slow) JS splits it into `.ch` letters that spring up one by
   one (55 ms stagger, overshoot), the glow widens, then an inline-SVG robot (`.bot`, user request) peeks up from
   behind the "A", clipped at the cap line, and idles (blink, antenna pulse, float). Reduced motion: appears at once.
- Nav CTA reads **"Book a Demo"** (user request); the hero CTA stays "Start a project".
All of it is switched off under `prefers-reduced-motion`.

Rules:
- Content changes go in `site/js/config.js`, never hard-coded in HTML.
- No inline `<script>`/`<style>`/`style=""` in HTML: the CSP blocks them. Set dynamic styles from JS via `style.setProperty`.
- Only Google Fonts and (optionally) Cloudflare Turnstile may load from third parties. Adding any other origin means editing `_headers`.
- Use `textContent`, never `innerHTML`, for config or user data.
- Backend secrets only in `backend/.env` (gitignored). Backend needs Node ≥ 20.

## Deploy

- **CD (2026-11-10):** project `trilemma-tech-innovation` is connected to GitHub `wakeawakee/TrilemmaAI`, production
  branch `master`, build command none, output `site`. Every push to master deploys automatically; other branches get
  preview URLs. `RESEND_API_KEY` is a secret on the project. Only the user can push (no GitHub credentials here).
- Static site: Cloudflare Pages, build command none, output directory `site`.
  **Live:** https://trilemma-tech-innovation.pages.dev (project `trilemma-tech-innovation`, account bistshree@gmail.com,
  direct upload, no git). The old project `tts-studio` (https://tts-studio-5ew.pages.dev) still exists with the same
  build; deploy to both until the user says to delete the old one.
  Redeploy: `npx wrangler pages deploy site --project-name trilemma-tech-innovation --branch main --commit-dirty=true`
  (then the same with `--project-name tts-studio`). No `--force`: it is only needed once, to create a project on
  classic Pages instead of Workers.
- Backend options: (a) run `backend/` on a small VPS/Render/Railway behind Cloudflare, proxy `/api/contact` or set
  `contactEndpoint` + `ALLOWED_ORIGIN` + `connect-src`; (b) later port it to a Cloudflare Pages Function with an email API.
- Production checklist: `TRUST_PROXY=1` behind Cloudflare, Turnstile keys, Cloudflare WAF + rate-limiting rule on `/api/contact`,
  "Always Use HTTPS" on, then submit the domain to hstspreload only once you are sure about HTTPS everywhere.

## Status

- [x] Backup of the original Nexora site: `../nexora-website-backup-2026-11-01/`
- [x] REA analysis of both reference sites
- [x] Rebuild: preloader, hero, studio, services, process, approach, careers, contact, footer
- [x] Config slots for contact/socials/services
- [x] Security: CSP + headers, backend rate limit/honeypot/header stripping/Turnstile hook, nodemailer upgraded (0 npm audit issues), backend tests pass
- [x] Browser QA desktop 1440 and mobile 390: 0 console errors, 0 CSP violations, no horizontal scroll, form works end to end
- [x] Real contact details (email, phone). Socials still pending
- [x] Static site deployed to Cloudflare Pages (preview URL, no custom domain yet)
- [x] Forms send to atrilemma@gmail.com (Resend), live-tested enquiry + CV on both projects 2026-11-08

## Session log

- 2026-11-01: Explored the old Nexora site. Installed Ponytail and REA plugins. Analyzed samatra.com + rpjdesign.com.au with REA.
  Rebuilt as TTI studio site in `site/`, hardened backend, QA'd in headless Chromium.
- 2026-11-01 (phone/RC session): mobile QA at 360/390/430/768 OK; logo tap target to 44px. Added 3D hero (grid floor tilt,
  3D text tilt) and the samatra-style scroll-scrubbed hero video slot (`heroVideo`, CSP `media-src 'self' blob:`).
  Tested with a generated test clip under the real CSP: playhead tracks scroll, 0 errors. Waiting on the user's Higgsfield clip.
  Later: deployed to Cloudflare Pages; hamburger menu; brand name under logo; Venn emblem (favicon, preloader, nav, footer).
  Responsive pass (320→2560): nav padding matches `.wrap` edges; `--wrap` 1480px ≥1800w and 1800px ≥2300w with larger
  type; rail hidden ≤1280w; landscape-phone (max-height 560) and ≤360w hero fixes; custom select chevron; footer
  rebuilt as brand / Navigate / Start a project columns + bottom bar with back-to-top. Verified 11 sizes: no overflow,
  nav aligned to content, hero fits the screen, 0 errors.
- 2026-11-07: Footer restyled after securitypalhq.com: giant gradient "Trilemma AI" wordmark + glow, revealed 2 s after
  entering view. Checked 320/390/1440/2560: fills width, no overflow, 0 errors. Deployed to both Pages projects.
- 2026-11-08: Footer contact = atrilemma@gmail.com / +977 9848210450. Careers mailto button replaced by a CV upload
  form + success pop-up. Both forms now post to functions/api/contact.js (Resend), 5 tests pass, browser-tested on
  wrangler pages dev at 1440/390. Wordmark: letters spring in 0.4 s after view + peeking robot. Social logo PNGs in
  site/assets/brand/. Deployed to both projects; email delivery waits on the Resend key.
- 2026-11-08 (later): forms refactored into lib/contact.js + Vercel api/contact.js (Nodemailer/Gmail) + Cloudflare
  wrapper; vercel.json; package.json type=module + nodemailer; git repo initialised (1 commit on main, remote
  origin = github.com/wakeawakee/TrilemmaAI, NOT pushed: no credentials here). 7 tests pass; forms browser-tested.
- 2026-11-10: Renamed to "Trilemma" everywhere (config, title, og:title, footer fallbacks, README); emblem now a single T
  in the Venn centre (symbol, favicon v=6, logo.svgs, all brand PNGs re-rendered). Checked preloader/nav/footer at
  1440 and 390: 0 errors. Local branch renamed main → master (user wants master on GitHub).
- 2026-11-10 (later): removed the T from the emblem everywhere; brand PNGs re-rendered; deployed to both Pages projects.
- 2026-11-10 (SEO): canonical https://www.trilemmai.com/, og/twitter tags + og-image, geo meta (NP-P3, Lalitpur),
  schema.org JSON-LD (ProfessionalService with address/phone/email/7 services + WebSite) inline as a data block (not
  executed, CSP fine, 0 errors); sitemap.xml, robots.txt Sitemap line, llms.txt. Services are duplicated in the JSON-LD
  and llms.txt because crawlers (esp. AI) don't run config.js: keep them in sync. config website = www.trilemmai.com.
  User asked to remove tts-studio: wrangler lost its login (needs `npx wrangler login`), so the user deletes it in the dashboard.
