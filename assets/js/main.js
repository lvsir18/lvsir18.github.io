(function () {
  'use strict';

  var root = document.documentElement;
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.theme-toggle');
  var yearEl = document.getElementById('year');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- theme ---------- */

  function syncToggleLabel() {
    if (!toggle) return;
    var isDark = root.getAttribute('data-theme') === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', isDark ? '切换浅色模式' : '切换深色模式');
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var isDark = root.getAttribute('data-theme') === 'dark';
      var next = isDark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      syncToggleLabel();
    });
  }

  syncToggleLabel();

  /* ---------- header state ---------- */

  function onScroll() {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  }

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- reveal on scroll ---------- */

  var revealEls = document.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(revealEls, function (el) {
      el.classList.add('is-visible');
    });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    Array.prototype.forEach.call(revealEls, function (el, i) {
      el.style.transitionDelay = Math.min(i % 3, 3) * 55 + 'ms';
      revealObserver.observe(el);
    });
  }

  /* ---------- active nav ---------- */

  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute('href');
      return id && id.charAt(0) === '#' ? document.querySelector(id) : null;
    })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle(
            'is-active',
            link.getAttribute('href') === '#' + entry.target.id
          );
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (section) { navObserver.observe(section); });
  }

  /* ---------- email menu ---------- */

  var emailItem = document.querySelector('.email-item');
  var emailTrigger = document.querySelector('.email-trigger');
  var emailMenu = document.getElementById('email-menu');

  function setMenu(open) {
    if (!emailTrigger || !emailMenu) return;
    emailMenu.hidden = !open;
    emailTrigger.setAttribute('aria-expanded', String(open));
  }

  if (emailItem && emailTrigger && emailMenu) {
    emailTrigger.addEventListener('click', function (e) {
      e.stopPropagation();
      setMenu(emailMenu.hidden);
    });

    document.addEventListener('click', function (e) {
      if (!emailMenu.hidden && !emailItem.contains(e.target)) setMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !emailMenu.hidden) {
        setMenu(false);
        emailTrigger.focus();
      }
    });

    emailMenu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
  }

  /* ---------- copy email ---------- */

  function legacyCopy(text) {
    var field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '-1000px';
    document.body.appendChild(field);
    field.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(field);
    return ok;
  }

  function copyEmail(btn) {
    var text = btn.getAttribute('data-copy-mail');
    var original = btn.dataset.label || btn.textContent;
    btn.dataset.label = original;

    function feedback(ok) {
      btn.textContent = ok ? '已复制到剪贴板' : '复制失败，请手动选择';
      clearTimeout(btn.copyTimer);
      btn.copyTimer = setTimeout(function () {
        btn.textContent = original;
      }, 1800);
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        function () { feedback(true); },
        function () { feedback(legacyCopy(text)); }
      );
    } else {
      feedback(legacyCopy(text));
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-copy-mail]'), function (btn) {
    btn.addEventListener('click', function () { copyEmail(btn); });
  });

  /* ---------- year ---------- */

  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
