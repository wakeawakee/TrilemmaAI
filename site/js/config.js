/*
 * All editable site content lives here. Edit this file, not index.html.
 * Empty strings are hidden on the page automatically.
 * Social and other links must start with https:// or they are ignored.
 */
window.SITE = {
  brand: { name: 'Trilemma' },
  footerWordmark: 'Trilemma AI',   // giant name at the bottom of the footer

  contact: {
    email: 'atrilemma@gmail.com',   // enquiries and CVs are emailed here too (MAIL_TO in functions/api/contact.js)
    phone: '+977 9848210450',
    location: 'Jhamsikhel, Lalitpur',
    website: 'https://trilemmai.com',
  },

  socials: [
    { label: 'LinkedIn', url: '' },
    { label: 'X', url: '' },
    { label: 'GitHub', url: '' },
    { label: 'Instagram', url: '' },
  ],

  // Where the enquiry + CV forms post (same site). Vercel: api/contact.js (Nodemailer + Gmail);
  // Cloudflare: functions/api/contact.js (Resend). Both email atrilemma@gmail.com.
  contactEndpoint: '/api/contact',

  // Scroll-scrubbed hero video, e.g. 'assets/hero.mp4' (same site only).
  // Empty = 3D grid hero. Encode with frequent keyframes so scrubbing is smooth:
  // ffmpeg -i in.mp4 -an -vf scale=1920:-2 -c:v libx264 -g 6 -crf 24 -movflags +faststart site/assets/hero.mp4
  heroVideo: '',

  // Cloudflare Turnstile site key (public). Leave empty to disable.
  turnstileSiteKey: '',

  services: [
    { group: 'Software', name: 'Web App Development', summary: 'Dashboards, portals and SaaS products with secure auth, clean APIs and an interface people enjoy using.', tags: ['SaaS', 'Portals', 'APIs'] },
    { group: 'Software', name: 'Web Design', summary: 'Brand-led websites that load fast, read clearly and turn visitors into enquiries.', tags: ['UI/UX', 'Brand sites', 'CMS'] },
    { group: 'Software', name: 'App Development', summary: 'iOS and Android apps, native or cross-platform, from first prototype to store release.', tags: ['iOS', 'Android', 'Cross-platform'] },
    { group: 'AI', name: 'AI Integration', summary: 'Put LLMs and machine learning to work inside your product and workflows, with evaluation built in.', tags: ['LLMs', 'RAG', 'Automation'] },
    { group: 'AI', name: 'Custom Chatbots', summary: 'Assistants trained on your docs and data for support, sales or internal knowledge, with clear guardrails.', tags: ['Support', 'Knowledge base', 'Lead capture'] },
    { group: 'Security', name: 'Penetration Testing', summary: 'Authorised, hands-on attacks on your apps, APIs and infrastructure, ending in a prioritised fix report.', tags: ['Web', 'API', 'Network'] },
    { group: 'Security', name: 'Vulnerability Assessment', summary: 'Systematic scanning and review that maps your weak points, ranked by real risk, with a retest after fixes.', tags: ['Scanning', 'Risk ranking', 'Retest'] },
  ],
};
