'use strict';
/**
 * dealer-suggest.js v2 — real Ford dealer directory, ZIP exact match.
 * Requires dealer-data.js (window.DEALER_ZIP) loaded first.
 *
 * Flow:
 *  1. After ZIP resolves, look up dealers by exact ZIP in DEALER_ZIP.
 *  2. 1+ matches → open lightbox listing them.
 *     "This is my dealership" → fill dealer fields, close.
 *     "Not listed / enter manually" or Escape/backdrop → close, keep city/state.
 *  3. 0 matches → no lightbox; user fills manually.
 */
(() => {
  function lookup(zip5) {
    var idx = window.DEALER_ZIP;
    if (!idx) return [];
    return idx[zip5] || [];
  }

  function fillFields(d) {
    var set = function(id, val) {
      var el = document.getElementById(id);
      if (el && val) { el.value = val; el.dispatchEvent(new Event('input')); }
    };
    set('dealer-name', d.n);
    set('address', d.s);
    set('city-text', d.c);
    set('state', d.st);
    set('zip', d.z);
    if (d.pa) set('pa-code', d.pa);
  }

  function buildLightbox(candidates) {
    var existing = document.getElementById('dealer-suggest-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'dealer-suggest-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'ds-title');
    modal.style.cssText = [
      'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center',
      'background:rgba(0,0,40,.55);padding:16px'
    ].join(';');

    var box = document.createElement('div');
    box.style.cssText = [
      'background:#fff;border-radius:12px;padding:28px 28px 24px;max-width:520px;width:100%',
      'box-shadow:0 8px 40px rgba(0,0,0,.22);max-height:80vh;overflow-y:auto;font-family:inherit'
    ].join(';');

    var title = document.createElement('h2');
    title.id = 'ds-title';
    title.textContent = 'Is this your dealership?';
    title.style.cssText = 'margin:0 0 6px;font-size:1.15rem;color:#003478;font-weight:700';
    box.appendChild(title);

    var sub = document.createElement('p');
    sub.textContent = 'Select your dealership to auto-fill your information.';
    sub.style.cssText = 'margin:0 0 18px;font-size:.875rem;color:#555';
    box.appendChild(sub);

    candidates.forEach(function(d) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = [
        'display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:8px',
        'border:1.5px solid #d0d7e2;border-radius:8px;background:#f8faff;cursor:pointer',
        'font-size:.9rem;line-height:1.4;transition:border-color .15s,background .15s'
      ].join(';');
      btn.innerHTML = '<strong style="color:#003478">' + d.n + '</strong><br>'
        + '<span style="color:#555;font-size:.83rem">' + d.s + ', ' + d.c + ', ' + d.st + ' ' + d.z + (d.pa ? ' &nbsp;·&nbsp; PA: ' + d.pa : '') + '</span>';
      btn.addEventListener('mouseover', function() {
        this.style.borderColor = '#003478'; this.style.background = '#eef2ff';
      });
      btn.addEventListener('mouseout', function() {
        this.style.borderColor = '#d0d7e2'; this.style.background = '#f8faff';
      });
      btn.addEventListener('click', function() {
        fillFields(d);
        close();
      });
      box.appendChild(btn);
    });

    var skip = document.createElement('button');
    skip.type = 'button';
    skip.textContent = 'My dealership isn\'t listed — enter manually';
    skip.style.cssText = [
      'margin-top:8px;background:none;border:none;color:#003478;font-size:.85rem',
      'cursor:pointer;text-decoration:underline;padding:4px 0'
    ].join(';');
    skip.addEventListener('click', close);
    box.appendChild(skip);

    modal.appendChild(box);
    document.body.appendChild(modal);

    // Trap focus — first interactive is first dealer button
    var focusable = modal.querySelectorAll('button');
    if (focusable.length) focusable[0].focus();

    modal.addEventListener('click', function(e) {
      if (e.target === modal) close();
    });
    document.addEventListener('keydown', onKey);

    function onKey(e) {
      if (e.key === 'Escape') close();
    }

    function close() {
      modal.remove();
      document.removeEventListener('keydown', onKey);
      var zipEl = document.getElementById('zip-input');
      if (zipEl) zipEl.focus();
    }
  }

  // Hook into ZIP resolution
  document.addEventListener('zip-resolved', function(e) {
    var zip5 = (e.detail && e.detail.zip) ? e.detail.zip.replace(/\D/g,'').slice(0,5).padStart(5,'0') : '';
    if (!zip5 || zip5.length < 5) return;
    var candidates = lookup(zip5);
    if (candidates.length > 0) {
      buildLightbox(candidates);
    }
  });
})();
