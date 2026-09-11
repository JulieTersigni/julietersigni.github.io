/* ==========================================================================
   Case study gate — AES-GCM decryption in the browser
   --------------------------------------------------------------------------
   The case study markup is never served in plaintext. It ships as AES-GCM
   ciphertext; the password derives the key via PBKDF2-SHA256. A wrong
   password fails the GCM authentication tag, so nothing renders.

   Requires a secure context (https:// or http://localhost) for
   window.crypto.subtle. Chrome and Firefox also treat file:// as secure;
   Safari does not, so test locally over http rather than opening the file.
   ========================================================================== */
(function () {
  'use strict';

  var payloadEl = document.getElementById('csPayload');
  var gate = document.getElementById('gate');
  var form = document.getElementById('gateForm');
  var input = document.getElementById('gatePassword');
  var errorEl = document.getElementById('gateError');
  var busyEl = document.getElementById('gateBusy');
  var submitBtn = form ? form.querySelector('button[type="submit"]') : null;
  var wrap = document.getElementById('csWrap');
  var content = document.getElementById('csContent');
  var revealBtn = document.getElementById('gateReveal');

  if (!payloadEl || !gate || !form || !wrap || !content) return;

  var payload = JSON.parse(payloadEl.textContent);
  var SESSION_KEY = 'jt-cs-pw';

  /* ---------------------------------------------------------------------- */
  /* Helpers                                                               */
  /* ---------------------------------------------------------------------- */
  function b64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function setError(message) {
    if (!errorEl) return;
    errorEl.textContent = message || '';
  }

  function setBusy(on) {
    if (busyEl) busyEl.classList.toggle('is-on', on);
    if (submitBtn) submitBtn.disabled = on;
    if (submitBtn) submitBtn.style.display = on ? 'none' : '';
  }

  function supported() {
    return !!(window.crypto && window.crypto.subtle && window.TextDecoder);
  }

  /* ---------------------------------------------------------------------- */
  /* Crypto                                                                */
  /* ---------------------------------------------------------------------- */
  function deriveKey(password, salt, iterations) {
    return crypto.subtle
      .importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (baseKey) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );
      });
  }

  /* The iteration count is read from the payload so the format can evolve, but
     floor it at the build's value — a hand-edited payload claiming `1` must not
     be honoured. */
  var MIN_ITERATIONS = 250000;

  function decrypt(password) {
    var salt = b64ToBytes(payload.salt);
    var iv = b64ToBytes(payload.iv);
    var data = b64ToBytes(payload.ct);

    var iterations = Math.max(payload.iterations || 0, MIN_ITERATIONS);

    return deriveKey(password, salt, iterations).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, data);
    }).then(function (buf) {
      return new TextDecoder().decode(buf);
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Unlock                                                                */
  /* ---------------------------------------------------------------------- */
  function unlock(password, isAuto) {
    if (!supported()) {
      setError('This browser can’t decrypt the case study. Please use a current version of Safari, Chrome, Firefox, or Edge over https.');
      return Promise.resolve(false);
    }

    setError('');
    setBusy(true);

    return decrypt(password).then(function (html) {
      content.innerHTML = html;
      gate.style.display = 'none';
      wrap.classList.add('is-unlocked');
      document.title = document.title.replace(/^Locked · /, '');
      try { sessionStorage.setItem(SESSION_KEY, password); } catch (e) {}
      wireLightbox();
      window.scrollTo(0, 0);

      // Focus lands on the article heading so a screen reader announces that the
      // case study opened, rather than dropping silently to <body>.
      var heading = content.querySelector('h1');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
      return true;
    }).catch(function () {
      setBusy(false);
      if (isAuto) {
        try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
        return false;
      }
      setError('That password isn’t right. Request access below and I’ll send it over.');
      var card = gate.querySelector('.gate-card');
      if (card) {
        card.classList.remove('gate-shake');
        // reflow so the animation can replay
        void card.offsetWidth;
        card.classList.add('gate-shake');
      }
      if (input) { input.select(); input.focus(); }
      return false;
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var password = input ? input.value : '';
    if (!password) {
      setError('Enter the password to continue.');
      return;
    }
    unlock(password.trim(), false);
  });

  if (input) {
    input.addEventListener('input', function () { setError(''); });
  }

  /* Show / hide password */
  if (revealBtn && input) {
    revealBtn.addEventListener('click', function () {
      var showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      revealBtn.classList.toggle('is-shown', !showing);
      revealBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      input.focus();
    });
  }

  /* Already unlocked this session → open straight away */
  (function tryAuto() {
    var saved = null;
    try { saved = sessionStorage.getItem(SESSION_KEY); } catch (e) {}
    if (saved) unlock(saved, true);
  })();

  /* ---------------------------------------------------------------------- */
  /* Lightbox for design artifacts                                         */
  /* ---------------------------------------------------------------------- */
  var lightboxWired = false;

  function wireLightbox() {
    var box = document.getElementById('lightbox');
    var boxImg = document.getElementById('lightboxImg');
    var closeBtn = document.getElementById('lightboxClose');
    if (!box || !boxImg) return;

    var lastFocused = null;

    function open(src, alt) {
      lastFocused = document.activeElement;
      boxImg.src = src;
      boxImg.alt = alt || '';
      box.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      if (closeBtn) closeBtn.focus();
    }

    function close() {
      box.classList.remove('is-open');
      document.body.style.overflow = '';
      boxImg.removeAttribute('src');
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    Array.prototype.forEach.call(content.querySelectorAll('.cs-shot'), function (btn) {
      btn.addEventListener('click', function () {
        var img = btn.querySelector('img');
        if (img) open(img.src, img.alt);
      });
    });

    // The listeners below live on the static template, not the injected markup,
    // so they must only ever be attached once.
    if (lightboxWired) return;
    lightboxWired = true;

    box.addEventListener('click', function (e) {
      // closeBtn has its own listener — excluded here so close() isn't run twice.
      if (e.target === box || e.target === boxImg) close();
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && box.classList.contains('is-open')) close();
    });
  }
})();
