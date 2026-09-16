/* ==========================================================================
   main.js — site chrome
   --------------------------------------------------------------------------
   Vanilla, no dependencies, no build step. Everything degrades: with
   JavaScript off you still get every public page, all the copy, and a résumé
   link that opens the PDF.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     Theme — set before paint by the inline script in each page's <head>, so
     this only handles the toggle and persistence.
     ------------------------------------------------------------------------ */
  var root = document.documentElement;
  var toggle = document.getElementById('themeToggle');

  function labelFor(theme) {
    return theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }

  if (toggle) {
    toggle.setAttribute('aria-label', labelFor(root.getAttribute('data-theme')));
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      toggle.setAttribute('aria-label', labelFor(next));
      try { localStorage.setItem('jt-theme', next); } catch (e) {}
    });
  }

  /* ------------------------------------------------------------------------
     Sticky nav hairline
     ------------------------------------------------------------------------ */
  var nav = document.getElementById('siteNav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ------------------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------------------ */
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    var setMenu = function (open) {
      navToggle.classList.toggle('is-open', open);
      navLinks.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    navToggle.addEventListener('click', function () {
      setMenu(!navLinks.classList.contains('is-open'));
    });

    navLinks.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });

    // A resize past the breakpoint leaves the panel orphaned otherwise.
    window.addEventListener('resize', function () {
      if (window.innerWidth > 720) setMenu(false);
    });
  }

  /* ------------------------------------------------------------------------
     Scroll reveal
     ------------------------------------------------------------------------ */
  var revealables = document.querySelectorAll('.reveal');

  if (revealables.length) {
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(revealables, function (el) {
        el.classList.add('is-in');
      });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

      Array.prototype.forEach.call(revealables, function (el) { io.observe(el); });
    }
  }

  /* ------------------------------------------------------------------------
     Résumé button state
     --------------------------------------------------------------------------
     tools/build.mjs writes assets/resume-data.js declaring whether a PDF is
     actually present. Until it is, show the "email me" note instead of a button
     that would 404. Once the PDF is dropped into assets/ and the build is rerun,
     the button enables itself with no HTML edit.

     This has to run BEFORE the [data-download] listeners are wired below, since
     it is what sets that attribute.
     ------------------------------------------------------------------------ */
  var resumeBtn = document.getElementById('resumeBtn');
  var resumePending = document.getElementById('resumePending');

  if (resumeBtn || resumePending) {
    var available = !!(window.__JT_RESUME__ && window.__JT_RESUME__.available);
    if (resumeBtn) resumeBtn.hidden = !available;
    // #resumePending ships visible so it still says something with JS off.
    if (resumePending) resumePending.hidden = available;
    if (available && resumeBtn && window.__JT_RESUME__.filename) {
      resumeBtn.setAttribute('href', 'assets/' + window.__JT_RESUME__.filename);
      resumeBtn.setAttribute('data-download', window.__JT_RESUME__.filename);
    }
  }

  /* ------------------------------------------------------------------------
     Résumé download
     --------------------------------------------------------------------------
     `<a download>` is not enough: Safari ignored it for years, and any browser
     set to "open PDFs in browser" previews the file instead. So fetch the
     bytes and click a synthetic link at a Blob URL. If fetch isn't available
     (file://), fall back to the base64 copy that tools/build.mjs emits.
     ------------------------------------------------------------------------ */
  function saveBlob(blob, filename) {
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(blob, filename);
      return;
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 4000);
  }

  function b64ToBlob(b64, type) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type || 'application/octet-stream' });
  }

  function fromEmbedded(filename) {
    var data = window.__JT_RESUME__;
    if (!data || !data.b64) return false;
    saveBlob(b64ToBlob(data.b64, data.type), data.filename || filename);
    return true;
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-download]'), function (link) {
    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href');
      var filename = link.getAttribute('data-download') || href.split('/').pop();

      // Let the browser handle it natively if we can't do better.
      if (!window.fetch || !window.Blob || !window.URL || !URL.createObjectURL) return;

      e.preventDefault();

      fetch(href)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.blob();
        })
        .then(function (blob) { saveBlob(blob, filename); })
        .catch(function () {
          // fetch fails on file:// — use the base64 copy, else just open it.
          if (!fromEmbedded(filename)) window.open(href, '_blank');
        });
    });
  });

  /* ------------------------------------------------------------------------
     Current year in the footer
     ------------------------------------------------------------------------ */
  Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
