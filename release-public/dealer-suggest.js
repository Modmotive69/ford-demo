'use strict';
/**
 * dealer-suggest.js
 * ZIP → dealer suggestion lightbox for FordEngage enrollment draft.
 *
 * COVERAGE NOTE: No authorised Ford dealer directory is available.
 * The dealer data loaded here is a SYNTHETIC TEST FIXTURE only.
 * In production (when window.DEALER_DATA is absent or empty), the lightbox
 * simply will not appear and the user fills dealer fields manually.
 * No real dealership records are fabricated or auto-assigned.
 *
 * Field keys filled on confirm: dealer-name, address, city-text (or city
 * select if shown), state, zip. These match existing form field ids/names
 * exactly. Signer fields (sig-name, sig-title, sig-phone, sig-email) are
 * never touched.
 *
 * Behaviour:
 *   1. After ZIP city/state resolves (zip-ok status), look up dealer data by zip5.
 *   2. If 1+ candidates: open lightbox listing them.
 *      "This is my dealership" → fill fields, close.
 *      "None of these / enter manually" or Escape/backdrop → close, leave
 *      manual, city/state already auto-filled and editable.
 *   3. If 0 candidates or no data: no lightbox; user fills manually.
 *   4. Focus trap + Escape + backdrop click.
 *   5. Multiple candidates shown; none auto-selected.
 */
(() => {
  // ── Dealer data source ──────────────────────────────────────────────────────
  // window.DEALER_DATA may be injected by a server or set before this script.
  // Format: Array of { name, street, city, state, zip, phone? }
  // zip must be a 5-digit string (leading zeros preserved).
  // In production with no directory this is empty → no lightbox, always manual.
  const DEALERS = (typeof window !== 'undefined' && window.DEALER_DATA) || [];

  // Build zip→dealers map for fast lookup
  const byZip = {};
  for (const d of DEALERS) {
    const z = String(d.zip || '').replace(/\D/g, '').substring(0, 5).padStart(5, '0');
    if (!byZip[z]) byZip[z] = [];
    byZip[z].push(d);
  }

  // ── DOM refs ─────────────────────────────────────────────────────────────────
  const zipInput    = document.getElementById('zip');
  const statusEl    = document.getElementById('zip-lookup-status');
  const dealerName  = document.getElementById('dealer-name');
  const addrField   = document.getElementById('address');
  const cityText    = document.getElementById('city-text');
  const citySelect  = document.getElementById('city');
  const stateSelect = document.getElementById('state');
  if (!zipInput || !statusEl || !dealerName) return;

  // ── Create lightbox (hidden) ─────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'dealer-suggest-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'ds-title');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = [
    'display:none;position:fixed;inset:0;z-index:1000',
    'background:rgba(0,0,0,0.52);align-items:center;justify-content:center;padding:16px'
  ].join(';');

  const panel = document.createElement('div');
  panel.id = 'dealer-suggest-panel';
  panel.style.cssText = [
    'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)',
    'background:#fff;border-radius:14px;max-width:560px;width:calc(100% - 32px)',
    'max-height:80vh;display:flex;flex-direction:column',
    'box-shadow:0 8px 40px rgba(0,0,0,0.22);overflow:hidden'
  ].join(';');

  panel.innerHTML = `
    <div style="padding:20px 22px 16px;border-bottom:1px solid #e0e8f4;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0">
      <h2 id="ds-title" style="margin:0;font-size:1rem;color:#003478;font-weight:700">
        Is this your dealership?
      </h2>
      <button id="ds-close" type="button" aria-label="Dismiss dealer suggestions"
        style="background:none;border:none;cursor:pointer;color:#555;font-size:1.3rem;padding:4px 8px;border-radius:6px;line-height:1">✕</button>
    </div>
    <div id="ds-list" role="list" style="overflow-y:auto;padding:12px 16px;flex:1"></div>
    <div style="padding:14px 16px;border-top:1px solid #e0e8f4;flex-shrink:0">
      <button id="ds-manual" type="button"
        style="width:100%;padding:12px;border:1px solid #ccd7e5;border-radius:8px;background:#f5f7fb;cursor:pointer;font:inherit;color:#003478;font-weight:500;text-align:left">
        None of these — I'll enter my dealership manually
      </button>
    </div>`;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // ── Lightbox state ───────────────────────────────────────────────────────────
  let lastFocusBeforeDs = null;

  function openLightbox(candidates) {
    lastFocusBeforeDs = document.activeElement;
    const list = document.getElementById('ds-list');
    list.innerHTML = '';

    candidates.forEach((d, idx) => {
      const item = document.createElement('div');
      item.setAttribute('role', 'listitem');
      item.style.cssText = 'margin:6px 0';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-idx', idx);
      btn.style.cssText = [
        'position:relative;width:100%;text-align:left;padding:14px 16px;border:1px solid #c5d8f0',
        'border-radius:10px;background:#fafbfd;cursor:pointer;font:inherit',
        'transition:background 0.15s'
      ].join(';');
      btn.innerHTML = `
        <div style="font-weight:600;color:#003478;margin-bottom:3px">${escHtml(d.name)}</div>
        <div style="font-size:0.84rem;color:#555">${escHtml(d.street)}, ${escHtml(d.city)}, ${escHtml(d.state)} ${escHtml(d.zip)}${d.phone ? ' · ' + escHtml(d.phone) : ''}</div>
        <div style="margin-top:8px;font-size:0.8rem;color:#003478;font-weight:500">✓ This is my dealership</div>`;
      btn.addEventListener('mouseenter', () => { btn.style.background = '#f0f4ff'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = '#fafbfd'; });
      btn.addEventListener('click', () => fillAndClose(d));
      btn.addEventListener('focus', () => { btn.style.outline = '3px solid #0078d4'; btn.style.outlineOffset = '2px'; });
      btn.addEventListener('blur',  () => { btn.style.outline = ''; });

      item.appendChild(btn);
      list.appendChild(item);
    });

    overlay.setAttribute('aria-hidden', 'false');
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Focus first candidate button
    const first = list.querySelector('button');
    if (first) first.focus();
  }

  function closeLightbox() {
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    if (lastFocusBeforeDs) lastFocusBeforeDs.focus();
  }

  function fillAndClose(d) {
    // Fill dealer fields — never signer fields
    if (dealerName) dealerName.value = d.name || '';
    if (addrField)  addrField.value  = d.street || '';

    // City: write into whichever control is visible
    const cityCtrl = citySelect && citySelect.style.display !== 'none' ? citySelect : cityText;
    if (cityCtrl && d.city) {
      cityCtrl.value = d.city;
      cityCtrl.dispatchEvent(new Event('input'));
    }

    // State
    if (stateSelect && d.state) {
      stateSelect.value = d.state;
      stateSelect.dispatchEvent(new Event('change'));
    }

    // ZIP (already filled by user; confirm correct 5-digit base)
    if (zipInput) {
      const z5 = String(d.zip || '').replace(/\D/g,'').substring(0,5).padStart(5,'0');
      if (z5 && zipInput.value.replace(/\D/g,'').substring(0,5).padStart(5,'0') === z5) {
        // matches — leave as-is
      }
    }

    closeLightbox();

    // Trigger signing summary update
    if (dealerName) dealerName.dispatchEvent(new Event('input'));
  }

  // ── Focus trap ───────────────────────────────────────────────────────────────
  overlay.addEventListener('keydown', e => {
    if (overlay.getAttribute('aria-hidden') !== 'false') return;
    if (e.key === 'Escape') { closeLightbox(); return; }
    if (e.key !== 'Tab') return;
    const focusable = [...overlay.querySelectorAll(
      'button:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )].filter(el => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeLightbox(); });
  document.getElementById('ds-close').addEventListener('click', closeLightbox);
  document.getElementById('ds-manual').addEventListener('click', closeLightbox);

  // ── Utility ──────────────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function normalizeZip(raw) {
    return String(raw || '').replace(/\D/g,'').substring(0,5).padStart(5,'0');
  }

  // ── Watch for ZIP resolved, then suggest ────────────────────────────────────
  // Poll the zip-lookup-status element for zip-ok class (set by zip-lookup.js).
  // Use a MutationObserver so we don't depend on tight coupling or event ordering.
  let lastSuggestedZip = '';

  const observer = new MutationObserver(() => {
    if (!statusEl.classList.contains('zip-ok')) return;
    const zip5 = normalizeZip(zipInput.value);
    if (!zip5 || zip5 === '00000' || zip5 === lastSuggestedZip) return;
    lastSuggestedZip = zip5;

    const candidates = byZip[zip5] || [];
    if (candidates.length > 0) openLightbox(candidates);
    // If 0 candidates: no lightbox, user fills manually (production default)
  });
  observer.observe(statusEl, { attributes: true, childList: true, characterData: true, subtree: true });

})();
