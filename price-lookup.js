'use strict';
/**
 * price-lookup.js — product + term selection → price resolution.
 *
 * Server re-validates against agreement.json termConfig + priceConfig.
 * Client amounts are NEVER trusted by the server.
 * Quote-required combos block submission.
 */
(() => {
  // ── Read authoritative config from embedded agreement blob ───────────────
  const dataEl = document.getElementById('draft-agreement-data');
  if (!dataEl) return;
  const agreement = JSON.parse(dataEl.textContent);
  const PRICES = agreement.priceConfig;   // { key: {price:cents|null, label} }
  const TERMS  = agreement.termConfig;    // { id: {label, discountPct, discountFactor, setupCents, setupLabel} }

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const form       = document.getElementById('enroll-form');
  const consentBox = document.getElementById('agree-checkbox');
  const summaryEl  = document.getElementById('signing-summary');
  if (!form || !consentBox) return;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function combKey(products) {
    return [...products].sort().join('+');
  }

  function selectedProducts() {
    // Base always included via hidden input; addons from checked addon-inputs
    const addons = Array.from(form.querySelectorAll('.addon-input:checked'), e => e.value);
    return ['FordEngage', ...addons];
  }

  function selectedTerm() {
    // Use document-level query to find checked radio regardless of form scope
    const radio = document.querySelector('#enroll-form input[name="term"]:checked');
    if (radio) return radio.value;
    const el = document.getElementById('term-select');
    return el ? el.value : 'month-to-month';
  }

  function syncProductCardState() {
    // BYP ptile layout — update check icons and state badges
    if (form) {
      form.querySelectorAll('label.ptile').forEach(tile => {
        const input   = tile.querySelector('.addon-input');
        const check   = tile.querySelector('.ptile-check');
        const badge   = tile.querySelector('.ptile-state-badge');
        const sel     = !!input?.checked;
        tile.classList.toggle('is-selected', sel);
        if (check) check.className = 'ptile-check ' + (sel ? 'ptile-check--on' : 'ptile-check--off');
        if (badge) {
          if (sel) {
            badge.className = 'ptile-state-badge ptile-state-badge--added';
            badge.innerHTML = '<svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true"><path d="M1 4.5l3 3 6-6" stroke="#0a6630" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> Added';
          } else {
            badge.className = 'ptile-state-badge ptile-state-badge--add';
            badge.innerHTML = '+ Add';
          }
        }
      });
    }
    // Sync BYP term radio label highlights — read actual radio checked state
    [['mtm','month-to-month'],['1yr','1year'],['2yr','2year']].forEach(([k,v]) => {
      const lbl   = document.getElementById('byp-term-lbl-' + k);
      const radio = document.getElementById('term-' + k);
      if (lbl && radio) lbl.classList.toggle('byp-term-opt--active', radio.checked);
    });
  }

  /** Cents-safe: all arithmetic in integer cents, convert at display only */
  function resolvePricing(products, termId) {
    if (!products.length) return null;
    const key   = combKey(products);
    const entry = PRICES[key];
    if (!entry) return null; // unknown combo (not in catalog)
    const tc         = TERMS[termId] || TERMS['month-to-month'];
    const baseCents  = Math.round(entry.price * 100);
    const discCents  = Math.round(baseCents * tc.discountFactor);
    const fmtCents   = c => '$' + (c / 100).toFixed(2).replace(/\.00$/, '');
    return {
      key,
      products,
      termId,
      termLabel:      tc.label,
      termMonths:     tc.termMonths,
      discountPct:    tc.discountPct,
      baseCents,
      baseLabel:      fmtCents(baseCents) + '/mo',
      discountedCents: discCents,
      discountedLabel: fmtCents(discCents) + '/mo',
      setupCents:     tc.setupCents,
      setupLabel:     tc.setupLabel,
    };
  }

  // ── Inject term selector immediately after product fieldset closes ────────
  const productFieldset = document.getElementById('product-selection');
  // Skip old term-select injection when BYP panel radios are present
  const hasBypPanel = !!document.getElementById('byp-cart');
  if (productFieldset && !document.getElementById('term-selector-section') && !hasBypPanel) {
    const termSection = document.createElement('div');
    termSection.id = 'term-selector-section';
    termSection.setAttribute('aria-live', 'polite');
    termSection.style.cssText = 'margin:20px 0 0';
    termSection.innerHTML = `
      <label for="term-select" style="font-weight:600;color:#003478;display:block;margin-bottom:8px">
        Pricing plan
      </label>
      <select id="term-select" name="term"
              style="width:100%;padding:12px;border:1px solid #718096;border-radius:4px;font:inherit;background:#fff;appearance:auto"
              aria-describedby="term-note">
        <option value="month-to-month">Month-to-month pricing — $1,000 one-time setup</option>
        <option value="1year">1-year (12 months) — setup waived, 10% off monthly</option>
        <option value="2year">2-year (24 months) — setup waived, 25% off monthly</option>
      </select>
      <p id="term-note" style="font-size:0.78rem;color:#6e6e73;margin:6px 0 0">
        Pricing plan selection applies to any priced product or bundle. Current agreement §3.1 still permits termination on 30 days' prior written notice; no early-exit fee or noncancelable minimum term is stated here. Quote-required combinations cannot be selected here.
      </p>`;
    productFieldset.insertAdjacentElement('afterend', termSection);

    document.getElementById('term-select').addEventListener('change', () => {
      updatePriceSummary();
      unconsent('You changed the pricing plan selection — please re-read and re-check consent.');
    });
  }

  // ── Inject Product & Price Summary immediately after term selector ────────
  const termSection = document.getElementById('term-selector-section');
  if (termSection && !document.getElementById('price-product-summary')) {
    const div = document.createElement('div');
    div.id = 'price-product-summary';
    div.setAttribute('aria-live', 'polite');
    div.style.cssText = [
      'border:1px solid #003478;border-radius:8px;padding:18px 20px;margin:20px 0 0',
      'background:#f5f8ff;font-family:Georgia,serif',
    ].join(';');
    div.innerHTML = `
      <div style="font-weight:700;color:#003478;margin-bottom:10px;font-size:0.95rem">
        Product &amp; Price Summary
        <span style="font-weight:400;font-size:0.8rem;color:#555;margin-left:8px">— incorporated into this Agreement</span>
      </div>
      <div id="pps-content" style="font-size:0.9rem;color:#555;font-style:italic">No products selected yet.</div>
      <p id="pps-note" style="margin:8px 0 0;font-size:0.78rem;color:#6e6e73">
        Fees invoiced monthly in arrears, payable within 30 days of PartSites invoice.
        Monthly fees commence after first-user onboarding as described in the Agreement.
      </p>`;
    termSection.insertAdjacentElement('afterend', div);
  }


  // ── CATALOG display prices (for breakdown only) ───────────────────────────
  // Bundle combos have a catalog price lower than sum of parts.
  // We show: base (Engage360 = $499), optional add-ons, then bundle adjustment.
  // Standalone catalog prices for breakdown display (NOT standalone enrollment):
  const DISPLAY_PRICES = {
    'FordEngage': 49900,       // $499/mo
    'eStore':     29900,       // $299/mo
    'VDP Widget': 19900,       // $199/mo
  };

  function fmtC(cents) {
    return '$' + (cents / 100).toFixed(2).replace(/\.00$/, '');
  }

  const DISPLAY_PRICES = { 'FordEngage': 49900, 'eStore': 29900, 'VDP Widget': 19900 };
  const PRODUCT_DETAILS = {
    'FordEngage': ['Engage360', 'Factory-accurate 4D accessory visualization on the showroom floor. Demonstrate any Ford or Lincoln accessory on the customer\u2019s actual vehicle \u2014 live, in color, from every angle.'],
    'eStore':     ['EnvyPRO eStore', 'Your dealer-branded accessory storefront, open 24/7. Customers browse, build, and buy genuine Ford accessories online \u2014 turning every web visit into accessory revenue.'],
    'VDP Widget': ['VDP Widget', 'Start the accessory sale before the showroom visit. Customers shop accessories alongside their vehicle on your VDP \u2014 with financed pricing, right next to the vehicle price.'],
  };

  function fmtC(cents) { return '$' + (cents / 100).toFixed(2).replace(/\.00$/, ''); }

  function renderBYP() {
    const prods  = selectedProducts();
    const termId = selectedTerm();
    const r      = resolvePricing(prods, termId);
    const addons = prods.filter(p => p !== 'FordEngage');

    // ── Panel header: show all selected product names ──────────────────────
    const hdrName = document.getElementById('byp-hdr-name');
    if (hdrName) {
      const names = prods.map(p => PRODUCT_DETAILS[p]?.[0] || p);
      hdrName.textContent = names.join(' + ');
    }

    // ── Product detail: description of last-selected addon (or base) ───────
    const detail = document.getElementById('byp-detail');
    if (detail) {
      // Show base description when only base; show most-recently-added addon desc otherwise
      const focusProd = addons.length ? addons[addons.length - 1] : 'FordEngage';
      const d = PRODUCT_DETAILS[focusProd];
      detail.textContent = d ? d[1] : '';
    }

    // ── Cart line items ────────────────────────────────────────────────────
    const cart = document.getElementById('byp-cart');
    if (!cart) return;

    if (!r) {
      cart.innerHTML = '<div class="byp-cart-empty">Select add-ons to see pricing.</div>';
      const ta = document.getElementById('byp-total-amount');
      if (ta) ta.textContent = '—';
      const sub = document.getElementById('byp-total-sub');
      if (sub) sub.textContent = 'per month · billed in arrears';
      return;
    }

    let html = '';

    // Base line
    html += `<div class="byp-line">
      <span class="byp-line-name byp-line-name--base">Engage360</span>
      <span class="byp-line-price">${fmtC(DISPLAY_PRICES['FordEngage'])}/mo</span>
    </div>`;

    // Addon lines
    addons.forEach(a => {
      html += `<div class="byp-line">
        <span class="byp-line-name">${a === 'eStore' ? 'EnvyPRO eStore' : 'VDP Widget'}</span>
        <span class="byp-line-price">${fmtC(DISPLAY_PRICES[a])}/mo</span>
      </div>`;
    });

    // Bundle adjustment (when catalog price < sum of parts)
    const sumParts = prods.reduce((s, p) => s + (DISPLAY_PRICES[p] || 0), 0);
    const adj = r.baseCents - sumParts; // negative = bundle saves
    if (addons.length && adj < 0) {
      html += `<div class="byp-line">
        <span class="byp-line-name byp-line-name--save">Bundle adjustment</span>
        <span class="byp-line-price byp-line-price--save">−${fmtC(Math.abs(adj))}/mo</span>
      </div>`;
    }

    // Term discount
    if (r.discountPct > 0) {
      const saved = r.baseCents - r.discountedCents;
      html += `<div class="byp-line">
        <span class="byp-line-name byp-line-name--save">${r.termLabel} discount (${r.discountPct}%)</span>
        <span class="byp-line-price byp-line-price--save">−${fmtC(saved)}/mo</span>
      </div>`;
    }

    cart.innerHTML = html;

    // ── Monthly total ──────────────────────────────────────────────────────
    const ta  = document.getElementById('byp-total-amount');
    const sub = document.getElementById('byp-total-sub');
    if (ta)  ta.textContent  = fmtC(r.discountedCents);
    if (sub) sub.textContent = 'per month · billed in arrears · ' + r.termLabel;

    // ── Setup fee ──────────────────────────────────────────────────────────
    const sv  = document.getElementById('byp-setup-val');
    if (sv) {
      if (r.setupCents > 0) {
        sv.textContent  = fmtC(r.setupCents);
        sv.className    = 'byp-setup-val--amount';
      } else {
        sv.textContent  = 'Waived';
        sv.className    = 'byp-setup-val--waived';
      }
    }
  }

  // Legacy renderCart() alias — keeps old pcart-body working if present
  function renderCart() { renderBYP(); }


  // ── Update Price Summary block ───────────────────────────────────────────
  function updatePriceSummary() {
    const prods   = selectedProducts();
    const termId  = selectedTerm();

    // Always update BYP cart panel + tile states (independent of legacy panel)
    syncProductCardState();
    renderBYP();

    // Legacy Product & Price Summary panel (signing summary block)
    const content = document.getElementById('pps-content');
    if (!content) return; // BYP-only layout — done after renderBYP above

    if (!prods.length) {
      content.style.cssText = 'font-size:0.9rem;color:#555;font-style:italic';
      content.innerHTML = 'No products selected yet.';
      return;
    }

    const r = resolvePricing(prods, termId);
    content.style.fontStyle = 'normal';
    content.style.color = '#1a1a1a';

    if (!r) {
      content.innerHTML = '<span style="color:#a21d16">Product combination not recognised. Reload the page.</span>';
      return;
    }
    const rows = [
      ['Products',       prods.map(p => p==='FordEngage'?'Engage360':p==='eStore'?'EnvyPRO eStore':p).join(' + ')],
      ['Pricing plan',   r.termLabel],
      ['Base monthly',   r.baseLabel],
    ];
    if (r.discountPct > 0) {
      rows.push(['Discount', r.discountPct + '%']);
      rows.push(['Discounted monthly', '<strong style="color:#003478;font-size:1.05rem">' + r.discountedLabel + '</strong>']);
    } else {
      rows.push(['Monthly fee', '<strong style="color:#003478;font-size:1.05rem">' + r.discountedLabel + '</strong>']);
    }
    rows.push(['One-time setup', r.setupCents === 0 ? '<span style="color:#1a7a3c;font-weight:600">Waived</span>' : '<strong>' + r.setupLabel + '</strong>']);
    content.innerHTML = '<table style="border-collapse:collapse;width:100%;font-size:0.9rem">' +
      rows.map(([k,v]) => `<tr><td style="padding:4px 12px 4px 0;color:#555;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:4px 0">${v}</td></tr>`).join('') +
      '</table>';

    syncProductCardState();
    renderBYP();
    updateSigningSummary();
  }

  // ── Consent reset helpers ────────────────────────────────────────────────
  let lastCheckedCombo = '';
  let lastCheckedTerm  = '';

  function unconsent(msg) {
    const prods = selectedProducts();
    const term  = selectedTerm();
    if (consentBox.checked && (prods.join(',') !== lastCheckedCombo || term !== lastCheckedTerm)) {
      consentBox.checked = false;
      consentBox.removeAttribute('aria-invalid');
      const errEl = document.getElementById('agree-checkbox-error');
      if (errEl) { errEl.textContent = msg || 'Product or term changed — please re-read and re-check consent.'; errEl.style.color = '#a56c00'; }
    }
  }

  consentBox.addEventListener('change', () => {
    if (consentBox.checked) {
      lastCheckedCombo = selectedProducts().join(',');
      lastCheckedTerm  = selectedTerm();
      const errEl = document.getElementById('agree-checkbox-error');
      if (errEl) { errEl.textContent = ''; errEl.style.color = '#a21d16'; }
    } else {
      lastCheckedCombo = '';
      lastCheckedTerm  = '';
    }
  });

  // ── Wire product checkboxes ──────────────────────────────────────────────
  // Wire BYP term radios via delegated form listener (catches all change events
  // regardless of trusted/synthetic origin) + direct per-radio listeners
  form.addEventListener('change', (e) => {
    if (e.target && e.target.name === 'term') {
      updatePriceSummary();
      if (e.target.value !== 'month-to-month') {
        unconsent('You changed the pricing plan \u2014 please re-read and re-check consent.');
      }
    }
  });
  // Belt: also listen at document level in case event doesn't bubble through form
  document.addEventListener('change', (e) => {
    if (e.target && e.target.name === 'term' && e.target.closest('#enroll-form')) {
      updatePriceSummary();
    }
  });
  // Wire BYP term label clicks: set radio checked, dispatch change, update
  document.querySelectorAll('.byp-term-opt').forEach(lbl => {
    lbl.addEventListener('click', (e) => {
      const radio = lbl.querySelector('input[type=radio]');
      if (radio && !radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // Always call updatePriceSummary on label click
      setTimeout(updatePriceSummary, 0);
    });
  });

  form.querySelectorAll('.product-option-input, .addon-input').forEach(input => {
    input.addEventListener('focus', () => input.closest('.prow, .product-option')?.classList.add('is-focused'));
    input.addEventListener('blur', () => input.closest('.prow, .product-option')?.classList.remove('is-focused'));
  });

  form.addEventListener('change', e => {
    if (e.target.name === 'products') {
      updatePriceSummary();
      unconsent('You changed the product selection — please re-read and re-check consent.');
    }
  });

  // ── Update signing summary (called by enrollment-draft.js via input event) ─
  function updateSigningSummary() {
    if (!summaryEl) return;
    const prods  = selectedProducts();
    const termId = selectedTerm();
    const r      = prods.length ? resolvePricing(prods, termId) : null;
    let priceStr;
    if (!r)               priceStr = 'None';
    else if (r.discountPct > 0)
      priceStr = r.discountedLabel + ' (' + r.discountPct + '% off base ' + r.baseLabel + ', ' + TERMS[termId].label + ')' +
                 (r.setupCents > 0 ? ' + ' + r.setupLabel : ', setup waived');
    else
      priceStr = r.discountedLabel + ' + ' + r.setupLabel;

    window._priceSummaryLine = 'Pricing plan: ' + (TERMS[termId]?.label || termId) + '\nProduct & Price: ' +
      (prods.length ? prods.map(p => p==='FordEngage'?'Engage360':p==='eStore'?'EnvyPRO eStore':p).join(' + ') : 'None') + ' — ' + priceStr;
    form.dispatchEvent(new Event('input', { bubbles: false }));
  }

  // ── Expose resolved pricing for submission payload ───────────────────────
  window.resolveEnrollmentPrice = function() {
    const prods  = selectedProducts();
    const termId = selectedTerm();
    if (!prods.length) return null;
    return resolvePricing(prods, termId);
  };

  // ── Init ─────────────────────────────────────────────────────────────────
  updatePriceSummary();
})();
