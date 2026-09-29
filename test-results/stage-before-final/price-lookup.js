'use strict';
/**
 * price-lookup.js — product selection → price resolution for FordEngage enrollment draft.
 *
 * Source: published enroll.html plan cards (verified 2026-09-28).
 * Server re-validates this same config in submit-enrollment.py before sending.
 * Client amounts are NEVER trusted by the server; server derives price from
 * selected product IDs against its own copy of PRICE_CONFIG.
 *
 * Two combinations are not in published plan cards and require a custom quote:
 *   FordEngage + eStore
 *   eStore + VDP Widget
 * These display a contact-sales notice; no dollar amount is inserted into the agreement.
 * Selection of a quote-required combination blocks submission with a clear message.
 */
(() => {
  // ── Authoritative price table (mirrors price-config.json) ────────────────
  // Keys are JS Array.prototype.sort() order (lexicographic, uppercase before lowercase)
  const PRICES = {
    'FordEngage':                   { price: 499,  label: '$499/mo' },
    'eStore':                       { price: 299,  label: '$299/mo' },
    'VDP Widget':                   { price: 199,  label: '$199/mo' },
    'FordEngage+VDP Widget':        { price: 649,  label: '$649/mo' },
    'FordEngage+VDP Widget+eStore': { price: 899,  label: '$899/mo' },   // all three
    'FordEngage+eStore':            { price: null, label: 'Contact sales for pricing' },
    'VDP Widget+eStore':            { price: null, label: 'Contact sales for pricing' }, // JS sort
  };

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const form          = document.getElementById('enroll-form');
  const consentBox    = document.getElementById('agree-checkbox');
  const summaryEl     = document.getElementById('signing-summary');
  const priceSummaryEl= document.getElementById('price-product-summary');  // injected below
  const submitBtn     = form ? form.querySelector('button[type=submit]') : null;
  if (!form || !consentBox) return;

  // ── Inject Product & Price Summary section (above consent/signature) ──────
  // Find the consent label and insert the summary block before it
  const consentLabel = form.querySelector('label[for="agree-checkbox"], .checkbox-row');
  if (consentLabel && !document.getElementById('price-product-summary')) {
    const div = document.createElement('div');
    div.id = 'price-product-summary';
    div.setAttribute('aria-live', 'polite');
    div.style.cssText = [
      'border:1px solid #003478;border-radius:8px;padding:18px 20px;margin:20px 0',
      'background:#f5f8ff;font-family:Georgia,serif',
    ].join(';');
    div.innerHTML = `
      <div style="font-weight:700;color:#003478;margin-bottom:10px;font-size:0.95rem">
        Product &amp; Price Summary
        <span style="font-weight:400;font-size:0.8rem;color:#555;margin-left:8px">
          — incorporated into this Agreement
        </span>
      </div>
      <div id="pps-content" style="font-size:0.9rem;color:#555;font-style:italic">
        No products selected yet.
      </div>
      <p id="pps-quote-notice" style="display:none;margin:10px 0 0;color:#a56c00;
         background:#fff8e6;border-left:3px solid #a56c00;padding:8px 12px;font-size:0.85rem">
      </p>
      <p id="pps-note" style="margin:8px 0 0;font-size:0.78rem;color:#6e6e73">
        Fees are monthly, invoiced in arrears. Payable within 30 days of receipt of PartSites invoice.
        Commencement after first-user onboarding as described in the Agreement.
      </p>
    `;
    consentLabel.parentNode.insertBefore(div, consentLabel);
  }

  // ── Core: compute price from selected products ────────────────────────────
  function combKey(products) {
    return [...products].sort().join('+');
  }

  function resolvePrice(products) {
    if (!products.length) return null;
    const key = combKey(products);
    return PRICES[key] || { price: null, label: 'Contact sales for pricing' };
  }

  function selectedProducts() {
    return Array.from(form.querySelectorAll('[name=products]:checked'), e => e.value);
  }

  // ── Update Product & Price Summary block ──────────────────────────────────
  let lastConsentState = false;

  function updatePriceSummary() {
    const prods = selectedProducts();
    const content   = document.getElementById('pps-content');
    const notice    = document.getElementById('pps-quote-notice');
    if (!content) return;

    if (!prods.length) {
      content.style.color = '#555';
      content.style.fontStyle = 'italic';
      content.innerHTML = 'No products selected yet.';
      notice.style.display = 'none';
      notice.textContent = '';
      updateConsentOnChange();
      return;
    }

    const resolved = resolvePrice(prods);
    const isQuote  = resolved.price === null;

    content.style.fontStyle = 'normal';
    content.style.color = '#1a1a1a';

    if (isQuote) {
      content.innerHTML =
        '<strong>' + prods.join(', ') + '</strong> — ' +
        '<span style="color:#a56c00;font-weight:600">Contact sales for pricing</span><br>' +
        '<span style="font-size:0.8rem;color:#6e6e73">This product combination is not listed as a standard plan. ' +
        'A custom quote is required before execution.</span>';
      notice.style.display = '';
      notice.textContent =
        'This combination requires a custom quote. You may submit this form to notify ' +
        'the sales team; no fee is confirmed or implied by submission.';
    } else {
      content.innerHTML =
        '<strong>' + prods.join(' + ') + '</strong>' +
        ' &nbsp;·&nbsp; <strong style="color:#003478;font-size:1.05rem">' + resolved.label + '</strong>' +
        '<br><span style="font-size:0.8rem;color:#6e6e73">per month · no fixed term · 30-day written notice to terminate</span>';
      notice.style.display = 'none';
      notice.textContent = '';
    }

    updateConsentOnChange();
    updateSigningSummary();
  }

  // ── Consent re-check when selection changes ───────────────────────────────
  function updateConsentOnChange() {
    const prods = selectedProducts();
    const wasChecked = consentBox.checked;

    // If user had checked consent and then changes product selection,
    // uncheck consent and require explicit re-check
    if (wasChecked && prods.join(',') !== lastCheckedCombo) {
      consentBox.checked = false;
      consentBox.removeAttribute('aria-invalid');
      const errEl = document.getElementById('agree-checkbox-error');
      if (errEl) {
        errEl.textContent = 'You changed the product selection — please re-read and re-check consent.';
        errEl.style.color = '#a56c00';
      }
    }
  }

  let lastCheckedCombo = '';
  consentBox.addEventListener('change', () => {
    if (consentBox.checked) {
      lastCheckedCombo = selectedProducts().join(',');
      const errEl = document.getElementById('agree-checkbox-error');
      if (errEl) { errEl.textContent = ''; errEl.style.color = '#a21d16'; }
    } else {
      lastCheckedCombo = '';
    }
  });

  // ── Wire product checkboxes ───────────────────────────────────────────────
  form.addEventListener('change', e => {
    if (e.target.name === 'products') updatePriceSummary();
  });

  // ── Update signing summary (called by enrollment-draft.js via form input event) ─
  // Override the existing updateSummary hook by exposing price data
  function updateSigningSummary() {
    if (!summaryEl) return;
    const prods    = selectedProducts();
    const resolved = prods.length ? resolvePrice(prods) : null;
    const priceStr = resolved
      ? (resolved.price !== null ? resolved.label : 'Contact sales — custom quote required')
      : 'None';
    // Expose for enrollment-draft.js to pick up
    window._priceSummaryLine = 'Product & Price: ' + (prods.length ? prods.join(' + ') : 'None') + ' — ' + priceStr;
    // Trigger enrollment-draft.js updateSummary by firing an input event
    form.dispatchEvent(new Event('input', { bubbles: false }));
  }

  // ── Expose resolved price for server validation payload ───────────────────
  window.resolveEnrollmentPrice = function() {
    const prods = selectedProducts();
    if (!prods.length) return null;
    const key = combKey(prods);
    const r   = PRICES[key] || { price: null, label: 'Contact sales for pricing' };
    return {
      combinationKey: key,
      products:       prods,
      price:          r.price,
      label:          r.label,
      isQuoteRequired: r.price === null,
    };
  };

  // ── Init ─────────────────────────────────────────────────────────────────
  updatePriceSummary();
})();
