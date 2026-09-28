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
    return Array.from(form.querySelectorAll('[name=products]:checked'), e => e.value);
  }

  function selectedTerm() {
    const el = document.getElementById('term-select');
    return el ? el.value : 'month-to-month';
  }

  function syncProductCardState() {
    form.querySelectorAll('.product-option').forEach(option => {
      const input = option.querySelector('.product-option-input');
      const card = option.querySelector('.product-card');
      const check = option.querySelector('.product-card-check');
      const selected = !!input?.checked;
      option.classList.toggle('is-selected', selected);
      if (card) {
        card.style.borderColor = selected ? '#003478' : '#e5ebf2';
        card.style.background = selected ? 'linear-gradient(180deg, #ffffff 0%, #f5f8ff 100%)' : '#fff';
        card.style.boxShadow = selected
          ? '0 18px 42px rgba(0, 52, 120, 0.14), 0 4px 12px rgba(0, 52, 120, 0.08)'
          : '0 12px 34px rgba(15, 42, 79, 0.08), 0 2px 8px rgba(15, 42, 79, 0.04)';
      }
      if (check) {
        check.style.backgroundColor = selected ? '#003478' : '#fff';
        check.style.borderColor = selected ? '#003478' : '#c4d0df';
        check.style.color = selected ? '#fff' : 'transparent';
      }
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
  if (productFieldset && !document.getElementById('term-selector-section')) {
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

  // ── Update Price Summary block ───────────────────────────────────────────
  function updatePriceSummary() {
    const prods   = selectedProducts();
    const termId  = selectedTerm();
    const content = document.getElementById('pps-content');
    if (!content) return;

    if (!prods.length) {
      content.style.cssText = 'font-size:0.9rem;color:#555;font-style:italic';
      content.innerHTML = 'No products selected yet.';
      syncProductCardState();
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
      ['Products',       prods.join(' + ')],
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
  form.querySelectorAll('.product-option-input').forEach(input => {
    input.addEventListener('focus', () => input.closest('.product-option')?.classList.add('is-focused'));
    input.addEventListener('blur', () => input.closest('.product-option')?.classList.remove('is-focused'));
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
      (prods.length ? prods.join(' + ') : 'None') + ' — ' + priceStr;
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
