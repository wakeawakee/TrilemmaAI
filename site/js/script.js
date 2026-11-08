/* TTI site: renders js/config.js content, preloader, scroll motion, contact form. */
(function () {
  'use strict';

  var SITE = window.SITE || {};
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function isHttps(url) { return typeof url === 'string' && /^https:\/\/[^\s]+$/.test(url); }

  /* ---------- Content from config ---------- */
  var contact = SITE.contact || {};
  var services = SITE.services || [];

  $$('[data-brand]').forEach(function (n) { n.textContent = (SITE.brand && SITE.brand.name) || 'TTI'; });
  $$('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });

  var list = $('[data-services]');
  var select = $('[data-service-select]');
  services.forEach(function (s, i) {
    var li = el('li', 'svc');
    li.setAttribute('data-reveal', '');
    li.appendChild(el('span', 'svc-no', pad(i + 1)));
    var body = el('div', 'svc-body');
    body.appendChild(el('span', 'svc-group', s.group));
    body.appendChild(el('h3', null, s.name));
    body.appendChild(el('p', null, s.summary));
    var tags = el('ul', 'tags');
    (s.tags || []).forEach(function (t) { tags.appendChild(el('li', null, t)); });
    body.appendChild(tags);
    li.appendChild(body);
    list.appendChild(li);

    var opt = el('option', null, s.name);
    opt.value = s.name;
    select.appendChild(opt);
  });
  var other = el('option', null, 'Something else');
  other.value = 'Other';
  select.appendChild(other);
  $('[data-svc-total]').textContent = pad(services.length);

  var contactItems = [
    contact.email && { label: 'Email', text: contact.email, href: 'mailto:' + contact.email },
    contact.phone && { label: 'Phone', text: contact.phone, href: 'tel:' + contact.phone.replace(/[^\d+]/g, '') },
    contact.location && { label: 'Address', text: contact.location },
    isHttps(contact.website) && { label: 'Website', text: contact.website.replace(/^https:\/\//, '').replace(/\/$/, ''), href: contact.website },
  ].filter(Boolean);
  $$('[data-contact]').forEach(function (contactList) {
    contactItems.forEach(function (c) {
      var li = el('li');
      li.appendChild(el('span', null, c.label));
      var v = el(c.href ? 'a' : 'span', null, c.text);
      if (c.href) v.href = c.href;
      li.appendChild(v);
      contactList.appendChild(li);
      contactList.hidden = false;
    });
  });

  $$('[data-socials]').forEach(function (ul) {
    (SITE.socials || []).filter(function (s) { return isHttps(s.url); }).forEach(function (s) {
      var a = el('a', null, s.label);
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      var li = el('li');
      li.appendChild(a);
      ul.appendChild(li);
      ul.hidden = false;
    });
  });


  /* ---------- Word-by-word statement ---------- */
  $$('[data-words]').forEach(function (p) {
    var units = [];
    Array.prototype.slice.call(p.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { units.push(document.createTextNode(part)); return; }
          units.push(el('span', 'w', part));
        });
      } else {
        node.classList.add('w');
        units.push(node);
      }
    });
    p.textContent = '';
    var i = 0;
    units.forEach(function (u) {
      if (u.nodeType === 1) u.style.setProperty('--i', i++);
      p.appendChild(u);
    });
    p.style.setProperty('--n', i);
  });

  /* ---------- Preloader ---------- */
  var pre = $('[data-preloader]');
  var count = $('[data-pl-count]');
  var start = performance.now();
  var MIN = reduce ? 200 : 1600;
  var finished = false;
  root.classList.add('loading');

  (function countUp() {
    if (finished) return;
    var v = Math.min(99, Math.floor((performance.now() - start) / MIN * 100));
    count.textContent = String(v).padStart(3, '0');
    requestAnimationFrame(countUp);
  })();

  var loaded = new Promise(function (r) {
    if (document.readyState === 'complete') r();
    else window.addEventListener('load', r, { once: true });
  });
  Promise.race([Promise.all([loaded, document.fonts ? document.fonts.ready : null]), wait(3500)])
    .then(function () { return wait(Math.max(0, MIN - (performance.now() - start))); })
    .then(function () {
      finished = true;
      count.textContent = '100';
      root.classList.remove('loading');
      root.classList.add('ready');
      pre.classList.add('done');
      setTimeout(function () { pre.remove(); }, 1200);
    });

  /* ---------- Nav + mobile menu ---------- */
  var nav = $('[data-nav]');
  var menu = $('[data-menu]');
  var menuBtn = $('[data-menu-btn]');

  function setMenu(open) {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    root.classList.toggle('menu-open', open);
  }
  menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });

  /* ---------- Scroll: pinned scenes, rail, nav state ---------- */
  var scenes = $$('[data-scene]');
  var hero = $('.hero');
  var rail = $('[data-rail]');
  var lastY = window.scrollY;
  var ticking = false;

  /* Hero video: fetched whole as a blob so seeking is instant, then scrubbed by scroll */
  var vid = $('[data-hero-video]');
  var vidT = 0;
  var vidLoop = false;
  if (SITE.heroVideo && !reduce) {
    fetch(SITE.heroVideo)
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.blob(); })
      .then(function (b) {
        vid.src = URL.createObjectURL(b);
        vid.addEventListener('loadedmetadata', function () {
          vid.hidden = false;
          hero.classList.add('has-video');
          onScroll();
        }, { once: true });
      })
      .catch(function () {});
  }
  // Ease the playhead toward the scroll target so the scrub feels cinematic, not steppy
  function scrub() {
    var d = vidT - vid.currentTime;
    if (Math.abs(d) < 0.02) { vidLoop = false; return; }
    if (!vid.seeking) vid.currentTime += d * 0.18;
    requestAnimationFrame(scrub);
  }

  function frame() {
    ticking = false;
    var vh = window.innerHeight;
    var y = window.scrollY;
    if (!reduce) {
      scenes.forEach(function (s) {
        var r = s.getBoundingClientRect();
        var p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)));
        s.style.setProperty('--p', p.toFixed(4));
        if (s === hero) {
          hero.classList.toggle('past', p > 0.4);
          if (!vid.hidden && vid.duration) {
            vidT = p * (vid.duration - 0.05);
            if (!vidLoop) { vidLoop = true; requestAnimationFrame(scrub); }
          }
        }
      });
    }
    nav.classList.toggle('scrolled', y > 20);
    nav.classList.toggle('hidden', y > lastY && y > 480 && menu.hidden);
    lastY = y;
    var max = document.documentElement.scrollHeight - vh;
    rail.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  frame();

  /* Active section → rail label + nav link */
  var sections = $$('[data-section]');
  var railIdx = $('[data-rail-idx]');
  var railName = $('[data-rail-name]');
  var navLinks = $$('.nav-links a');
  var sectionIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      railIdx.textContent = pad(sections.indexOf(e.target));
      railName.textContent = e.target.getAttribute('data-section');
      navLinks.forEach(function (a) {
        if (a.getAttribute('href') === '#' + e.target.id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-50% 0px -50% 0px' });
  sections.forEach(function (s) { sectionIO.observe(s); });

  /* Service row closest to the middle of the screen is "active" */
  var rows = $$('.svc');
  var svcCurrent = $('[data-svc-current]');
  var rowIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      rows.forEach(function (r) { r.classList.toggle('is-active', r === e.target); });
      svcCurrent.textContent = pad(rows.indexOf(e.target) + 1);
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  rows.forEach(function (r) { rowIO.observe(r); });
  if (rows[0]) rows[0].classList.add('is-active');

  /* Reveal on enter */
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  $$('[data-reveal]').forEach(function (n) { revealIO.observe(n); });

  /* Footer wordmark: letters spring up one by one shortly after it scrolls into view, then the robot peeks out */
  var word = $('[data-footer-word]');
  var wordText = $('[data-footer-text]');
  var letters = SITE.footerWordmark || wordText.textContent;
  wordText.textContent = '';
  Array.from(letters).forEach(function (c, i) {
    var s = el('span', 'ch', c === ' ' ? ' ' : c); // nbsp: a lone space in an inline-block collapses
    s.style.setProperty('--i', i);
    wordText.appendChild(s);
  });
  var wordIO = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting) return;
    wordIO.disconnect();
    setTimeout(function () { word.classList.add('in'); }, reduce ? 0 : 400);
  }, { threshold: 0.3 });
  wordIO.observe(word);

  /* ---------- Enquiry form + careers CV form (both post multipart to the same endpoint) ---------- */
  var endpoint = SITE.contactEndpoint || '/api/contact';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var MAX_CV = 4 * 1024 * 1024; // matches lib/contact.js (Vercel caps uploads at 4.5 MB)

  if (SITE.turnstileSiteKey) {
    $$('[data-turnstile]').forEach(function (box) {
      box.className = 'cf-turnstile';
      box.setAttribute('data-sitekey', SITE.turnstileSiteKey);
      box.setAttribute('data-theme', 'dark');
    });
    var ts = document.createElement('script');
    ts.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    ts.async = true;
    document.head.appendChild(ts);
  }

  var cvDialog = $('[data-cv-dialog]');
  $('[data-cv-dialog-close]').addEventListener('click', function () { cvDialog.close(); });

  // required: field names that must be non-empty; check(data) returns extra { field: message } problems
  function wireForm(form, required, check, onDone) {
    var status = $('[data-status]', form);
    function say(msg, kind) {
      status.textContent = msg;
      status.className = 'status ' + (kind || '');
    }
    $$('input, select, textarea', form).forEach(function (f) {
      f.addEventListener('input', function () { f.classList.remove('invalid'); });
      f.addEventListener('change', function () { f.classList.remove('invalid'); });
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var data = new FormData(form);
      var bad = required.filter(function (k) { return !String(data.get(k) || '').trim(); });
      if (!EMAIL_RE.test(String(data.get('email') || '').trim())) bad.push('email');
      var extra = check ? check(data) : {};
      Object.keys(extra).forEach(function (k) { if (bad.indexOf(k) < 0) bad.push(k); });
      $$('.invalid', form).forEach(function (f) { f.classList.remove('invalid'); });
      if (bad.length) {
        bad.forEach(function (k) { form.elements[k].classList.add('invalid'); });
        form.elements[bad[0]].focus();
        say(extra[bad[0]] || 'Please fill in the highlighted fields.', 'err');
        return;
      }

      var btn = $('button[type="submit"]', form);
      // Honeypot filled = bot: act as if it worked and send nothing.
      if (String(data.get('website') || '')) { form.reset(); onDone(say); return; }
      btn.disabled = true;
      say('Sending…');
      fetch(endpoint, { method: 'POST', body: data })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok && j.ok, status: res.status, j: j }; }); })
        .then(function (r) {
          if (!r.ok) throw r;
          form.reset();
          if (window.turnstile) window.turnstile.reset();
          say('');
          onDone(say);
        })
        .catch(function (r) {
          // 400/413 explain what to fix; anything else is our side, so point to the email address
          if (r && (r.status === 400 || r.status === 413) && r.j && r.j.error) return say('Please check the form: ' + r.j.error + '.', 'err');
          say(contact.email
            ? 'Something went wrong sending the form. Please email us at ' + contact.email + '.'
            : 'Something went wrong sending the form. Please try again in a moment.', 'err');
        })
        .then(function () { btn.disabled = false; });
    });
  }

  wireForm($('[data-form]'), ['name', 'service', 'details'], null, function (say) {
    say('Thank you. Your enquiry is in and we will reply within one business day.', 'ok');
  });

  wireForm($('[data-cv-form]'), ['name'], function (data) {
    var f = data.get('cv');
    if (!f || !f.size) return { cv: 'Please choose your CV file.' };
    if (!/\.(pdf|docx?)$/i.test(f.name)) return { cv: 'Your CV must be a PDF, DOC or DOCX file.' };
    if (f.size > MAX_CV) return { cv: 'Your CV must be 4 MB or smaller.' };
    return {};
  }, function () { cvDialog.showModal(); });
})();
