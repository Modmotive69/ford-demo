'use strict';
/**
 * price-lookup.js — canonical enrollment pricing + Build Your Plan sync.
 * v review-17: World Domination package mode (mutually exclusive with individual addons)
 *
 * Two modes:
 *   CUSTOM  — Engage360 always included + any combo of eStore / VDP Widget
 *   PACKAGE — World Domination: all three products + 32" 4K kiosk, $999/mo
 *             Selecting WD clears addon checks; addon tiles show "Included in World Domination"
 *             Selecting any addon while WD is active exits package mode
 *
 * Submission payload:
 *   CUSTOM:  selectedProducts() = ['FordEngage', ...checkedAddons]
 *   PACKAGE: selectedProducts() = ['WorldDomination']  (Engage360 implied server-side, no double-charge)
 *
 * Pricing gate: WD is $999/mo per commercial decision 2026-09-28.
 */
(() => {
  const dataEl = document.getElementById('draft-agreement-data');
  if (!dataEl) return;
  const agreement = JSON.parse(dataEl.textContent);
  const PRICES = agreement.priceConfig;
  const TERMS  = agreement.termConfig;

  const form       = document.getElementById('enroll-form');
  const consentBox = document.getElementById('agree-checkbox');
  const summaryEl  = document.getElementById('signing-summary');
  if (!form || !consentBox) return;

  // ── Display-only individual prices (for custom mode cart breakdown) ──
  const __BYP_DISPLAY_PRICES__ = {
    'FordEngage':  49900,
    'eStore':      29900,
    'VDP Widget':  19900,
  };

  // ── Product details: name + right-panel description ──
  const __BYP_PRODUCT_DETAILS__ = {
    'FordEngage': {
      name: 'Engage360',
      detail: 'Factory-accurate 4D accessory visualization on the showroom floor. Demonstrate any Ford or Lincoln accessory on the customer\'s actual vehicle — live, in color, from every angle.',
    },
    'eStore': {
      name: 'EnvyPRO eStore',
      detail: 'Your dealer-branded accessory storefront, open 24/7. Customers browse, build, and buy genuine Ford accessories online — turning every web visit into accessory revenue.',
    },
    'VDP Widget': {
      name: 'VDP Widget',
      detail: 'Start the accessory sale before the showroom visit. Customers shop accessories alongside their vehicle on your VDP — with financed pricing, right next to the vehicle price.',
    },
    'WorldDomination': {
      name: 'World Domination',
      detail: 'All three products in one complete showroom package: Engage360, EnvyPRO eStore, and VDP Widget — plus a 32-inch 4K kiosk, a $1,000 value included at no additional charge.',
    },
  };

  // ── WD package: which addon keys are included ──
  const WD_INCLUDED_ADDONS = ['eStore', 'VDP Widget'];

  function fmtC(cents) {
    return '$' + (cents / 100).toFixed(2).replace(/\.00$/, '');
  }

  function combKey(products) {
    return [...products].sort().join('+');
  }

  // ── Mode detection ──
  function isWDMode() {
    const wdInput = document.getElementById('product-wd');
    return !!wdInput?.checked;
  }

  // ── Authoritative product list for payload + pricing ──
  function selectedProducts() {
    if (isWDMode()) return ['WorldDomination'];
    const addons = Array.from(form.querySelectorAll('.addon-input:checked'), e => e.value);
    return ['FordEngage', ...addons];
  }

  function selectedTerm() {
    const radio = document.querySelector('#enroll-form input[name="term"]:checked');
    if (radio) return radio.value;
    const sel = document.getElementById('term-select');
    return sel ? sel.value : 'month-to-month';
  }

  // ── Pricing resolution ──
  function resolvePricing(products, termId) {
    if (!products.length) return null;

    // WD package: single key lookup
    if (products.length === 1 && products[0] === 'WorldDomination') {
      const entry = PRICES['WorldDomination'];
      if (!entry || entry.price === null) return null; // safety gate
      const tc        = TERMS[termId] || TERMS['month-to-month'];
      const baseCents = Math.round(entry.price * 100);
      const discCents = Math.round(baseCents * tc.discountFactor);
      return {
        key: 'WorldDomination',
        products,
        termId,
        termLabel:       tc.label,
        termMonths:      tc.termMonths,
        discountPct:     tc.discountPct,
        baseCents,
        baseLabel:       fmtC(baseCents) + '/mo',
        discountedCents: discCents,
        discountedLabel: fmtC(discCents) + '/mo',
        setupCents:      tc.setupCents,
        setupLabel:      tc.setupLabel,
        isWD:            true,
      };
    }

    // Custom mode: key lookup
    const key   = combKey(products);
    const entry = PRICES[key];
    if (!entry || entry.price === null) return null;
    const tc         = TERMS[termId] || TERMS['month-to-month'];
    const baseCents  = Math.round(entry.price * 100);
    const discCents  = Math.round(baseCents * tc.discountFactor);
    return {
      key,
      products,
      termId,
      termLabel:       tc.label,
      termMonths:      tc.termMonths,
      discountPct:     tc.discountPct,
      baseCents,
      baseLabel:       fmtC(baseCents) + '/mo',
      discountedCents: discCents,
      discountedLabel: fmtC(discCents) + '/mo',
      setupCents:      tc.setupCents,
      setupLabel:      tc.setupLabel,
      isWD:            false,
    };
  }

  function syncTermLabelState() {
    const term = selectedTerm();
    [['mtm','month-to-month'],['1yr','1year'],['2yr','2year']].forEach(([slug, val]) => {
      const lbl = document.getElementById('byp-term-lbl-' + slug);
      if (lbl) lbl.classList.toggle('byp-term-opt--active', term === val);
    });
  }

  // ── Tile visual state ──
  function syncProductTileState() {
    const wd = isWDMode();

    // ── WD tile ──
    const wdTile  = document.getElementById('ptile-wd');
    const wdCheck = document.getElementById('ptile-wd-check');
    const wdBadge = document.getElementById('ptile-wd-badge');
    if (wdTile) wdTile.classList.toggle('is-selected', wd);
    if (wdCheck) wdCheck.className = 'ptile-check ' + (wd ? 'ptile-check--on' : 'ptile-check--off');
    if (wdBadge) {
      if (wd) {
        wdBadge.className = 'ptile-state-badge ptile-state-badge--added';
        wdBadge.innerHTML = '<svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true"><path d="M1 4.5l3 3 6-6" stroke="#0a6630" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> Package selected';
      } else {
        wdBadge.className = 'ptile-state-badge ptile-state-badge--add';
        wdBadge.textContent = '+ Select package';
      }
    }

    // ── Addon tiles (eStore, VDP Widget) ──
    form.querySelectorAll('label.ptile:not(.ptile--wd)').forEach(tile => {
      const input = tile.querySelector('.addon-input');
      const check = tile.querySelector('.ptile-check');
      const badge = tile.querySelector('.ptile-state-badge');
      if (!input) return;

      if (wd) {
        // In WD mode: mark included, disable interaction
        const included = WD_INCLUDED_ADDONS.includes(input.value);
        tile.classList.toggle('is-selected', false);
        tile.classList.toggle('ptile--wd-included', included);
        if (check) check.className = 'ptile-check ' + (included ? 'ptile-check--on' : 'ptile-check--off');
        if (badge && included) {
          badge.className = 'ptile-state-badge';
          badge.style.background = '#ece6ff';
          badge.style.color = '#4b2ea6';
          badge.innerHTML = '<svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true"><path d="M1 4.5l3 3 6-6" stroke="#4b2ea6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> In World Domination';
        }
      } else {
        // Custom mode: restore normal selectable state
        tile.classList.remove('ptile--wd-included');
        if (badge) { badge.style.background = ''; badge.style.color = ''; }
        const selected = !!input.checked;
        tile.classList.toggle('is-selected', selected);
        if (check) check.className = 'ptile-check ' + (selected ? 'ptile-check--on' : 'ptile-check--off');
        if (badge) {
          if (selected) {
            badge.className = 'ptile-state-badge ptile-state-badge--added';
            badge.innerHTML = '<svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true"><path d="M1 4.5l3 3 6-6" stroke="#0a6630" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> Added';
          } else {
            badge.className = 'ptile-state-badge ptile-state-badge--add';
            badge.textContent = '+ Add';
          }
        }
      }
    });

    syncTermLabelState();
  }

  function renderLegacySummary(prods, r) {
    const content = document.getElementById('pps-content');
    if (!content) return;
    if (!r) {
      content.style.cssText = 'font-size:0.9rem;color:#555;font-style:italic';
      content.innerHTML = 'No products selected yet.';
      return;
    }
    const displayProds = r.isWD
      ? ['Engage360', 'EnvyPRO eStore', 'VDP Widget', '32" 4K Kiosk']
      : prods.map(p => __BYP_PRODUCT_DETAILS__[p]?.name || p);
    const rows = [
      ['Products', displayProds.join(' + ')],
      ['Pricing plan', r.termLabel],
      ['Base monthly', r.baseLabel],
    ];
    if (r.discountPct > 0) {
      rows.push(['Discount', r.discountPct + '%']);
      rows.push(['Discounted monthly', '<strong style="color:#003478;font-size:1.05rem">' + r.discountedLabel + '</strong>']);
    } else {
      rows.push(['Monthly fee', '<strong style="color:#003478;font-size:1.05rem">' + r.discountedLabel + '</strong>']);
    }
    if (r.isWD) rows.push(['Kiosk', '$1,000 value — included']);
    rows.push(['One-time setup', r.setupCents === 0 ? '<span style="color:#1a7a3c;font-weight:600">Waived</span>' : '<strong>' + r.setupLabel + '</strong>']);
    content.style.cssText = '';
    content.innerHTML = '<table style="border-collapse:collapse;width:100%;font-size:0.9rem">' +
      rows.map(([k,v]) => `<tr><td style="padding:4px 12px 4px 0;color:#555;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:4px 0">${v}</td></tr>`).join('') +
      '</table>';
  }

  function renderBYP(prods, termId) {
    if (!prods)  prods  = selectedProducts();
    if (!termId) termId = selectedTerm();
    const r   = resolvePricing(prods, termId);
    const wd  = r?.isWD;

    // Header name
    const hdrName = document.getElementById('byp-hdr-name');
    if (hdrName) {
      hdrName.textContent = wd
        ? 'World Domination'
        : prods.map(p => __BYP_PRODUCT_DETAILS__[p]?.name || p).join(' + ');
    }

    // Detail panel
    const detail = document.getElementById('byp-detail');
    if (detail) {
      if (wd) {
        detail.textContent = __BYP_PRODUCT_DETAILS__['WorldDomination'].detail;
      } else {
        const addons = prods.filter(p => p !== 'FordEngage');
        const focus = addons.length ? addons[addons.length - 1] : 'FordEngage';
        detail.textContent = __BYP_PRODUCT_DETAILS__[focus]?.detail || '';
      }
    }

    const cart = document.getElementById('byp-cart');
    if (!cart) return;

    if (!r) {
      cart.innerHTML = '<div class="byp-cart-empty">Select add-ons to see pricing.</div>';
      const ta = document.getElementById('byp-total-amount');
      const sub = document.getElementById('byp-total-sub');
      const sv = document.getElementById('byp-setup-val');
      if (ta) ta.textContent = '—';
      if (sub) sub.textContent = 'per month · billed in arrears';
      if (sv) { sv.textContent = '—'; sv.className = 'byp-setup-val--amount'; }
      return;
    }

    let html = '';
    if (wd) {
      // WD package cart: list all components, no individual pricing shown (single package price)
      html += `<div class="byp-line"><span class="byp-line-name byp-line-name--base">Engage360</span><span class="byp-line-price byp-line-price--incl">Included</span></div>`;
      html += `<div class="byp-line"><span class="byp-line-name">EnvyPRO eStore</span><span class="byp-line-price byp-line-price--incl">Included</span></div>`;
      html += `<div class="byp-line"><span class="byp-line-name">VDP Widget</span><span class="byp-line-price byp-line-price--incl">Included</span></div>`;
      html += `<div class="byp-line"><span class="byp-line-name">32" 4K Kiosk</span><span class="byp-line-price byp-line-price--incl">$1,000 value</span></div>`;
    } else {
      const addons = prods.filter(p => p !== 'FordEngage');
      html += `<div class="byp-line"><span class="byp-line-name byp-line-name--base">Engage360</span><span class="byp-line-price">${fmtC(__BYP_DISPLAY_PRICES__['FordEngage'])}/mo</span></div>`;
      addons.forEach(a => {
        html += `<div class="byp-line"><span class="byp-line-name">${__BYP_PRODUCT_DETAILS__[a]?.name || a}</span><span class="byp-line-price">${fmtC(__BYP_DISPLAY_PRICES__[a])}/mo</span></div>`;
      });
      const sumParts = prods.reduce((s,p) => s + (__BYP_DISPLAY_PRICES__[p] || 0), 0);
      const adj = r.baseCents - sumParts;
      if (addons.length && adj < 0) {
        html += `<div class="byp-line"><span class="byp-line-name byp-line-name--save">Bundle adjustment</span><span class="byp-line-price byp-line-price--save">−${fmtC(Math.abs(adj))}/mo</span></div>`;
      }
    }

    if (r.discountPct > 0) {
      const saved = r.baseCents - r.discountedCents;
      html += `<div class="byp-line"><span class="byp-line-name byp-line-name--save">${r.termLabel} discount (${r.discountPct}%)</span><span class="byp-line-price byp-line-price--save">−${fmtC(saved)}/mo</span></div>`;
    }
    cart.innerHTML = html;

    const ta = document.getElementById('byp-total-amount');
    const sub = document.getElementById('byp-total-sub');
    const sv = document.getElementById('byp-setup-val');
    if (ta) ta.textContent = fmtC(r.discountedCents);
    if (sub) sub.textContent = 'per month · billed in arrears · ' + r.termLabel;
    if (sv) {
      if (r.setupCents > 0) {
        sv.textContent = fmtC(r.setupCents);
        sv.className = 'byp-setup-val--amount';
      } else {
        sv.textContent = 'Waived';
        sv.className = 'byp-setup-val--waived';
      }
    }
  }

  function updateSigningSummary() {
    if (!summaryEl) return;
    const prods  = selectedProducts();
    const termId = selectedTerm();
    const r      = resolvePricing(prods, termId);
    const wd     = r?.isWD;
    let priceStr;
    if (!r) {
      priceStr = 'None';
    } else if (r.discountPct > 0) {
      priceStr = r.discountedLabel + ' (' + r.discountPct + '% off base ' + r.baseLabel + ', ' + TERMS[termId].label + ')' +
        (r.setupCents > 0 ? ' + ' + r.setupLabel : ', setup waived');
    } else {
      priceStr = r.discountedLabel + (r.setupCents > 0 ? ' + ' + r.setupLabel : ', setup waived');
    }
    const prodLabel = wd
      ? 'World Domination (Engage360 + EnvyPRO eStore + VDP Widget + 32" 4K Kiosk)'
      : (prods.length ? prods.map(p => __BYP_PRODUCT_DETAILS__[p]?.name || p).join(' + ') : 'None');

    window._priceSummaryLine = 'Pricing plan: ' + (TERMS[termId]?.label || termId) + '\nProduct & Price: ' + prodLabel + ' — ' + priceStr;
    form.dispatchEvent(new Event('input', { bubbles: false }));
  }

  // ── Re-consent on change ──
  let lastCheckedCombo = '';
  let lastCheckedTerm  = '';
  function unconsent(msg) {
    const combo = selectedProducts().join(',');
    const term  = selectedTerm();
    if (consentBox.checked && (combo !== lastCheckedCombo || term !== lastCheckedTerm)) {
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

  function syncAll() {
    const prods = selectedProducts();
    const term  = selectedTerm();
    syncProductTileState();
    renderBYP(prods, term);
    renderLegacySummary(prods, resolvePricing(prods, term));
    updateSigningSummary();
  }

  // ── WD input: selecting WD clears individual addon checkboxes ──
  const wdInput = document.getElementById('product-wd');
  if (wdInput) {
    wdInput.addEventListener('change', () => {
      if (wdInput.checked) {
        // Clear all individual addon checkboxes
        form.querySelectorAll('.addon-input').forEach(cb => { cb.checked = false; });
      }
      syncAll();
      unconsent('Package selection changed — please re-read and re-check consent.');
    });
  }

  // ── Addon inputs: selecting any addon while WD is active exits WD mode ──
  form.querySelectorAll('.addon-input').forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked && isWDMode()) {
        // Exit WD mode
        if (wdInput) wdInput.checked = false;
      }
      syncAll();
      unconsent('You changed the product selection — please re-read and re-check consent.');
    });
    input.addEventListener('focus', () => input.closest('.ptile, .byp-term-opt')?.classList.add('is-focused'));
    input.addEventListener('blur',  () => input.closest('.ptile, .byp-term-opt')?.classList.remove('is-focused'));
  });

  // ── Term selector ──
  document.querySelectorAll('input[name="term"]').forEach(radio => {
    radio.addEventListener('change', () => {
      syncAll();
      unconsent('You changed the pricing plan — please re-read and re-check consent.');
    });
  });
  document.querySelectorAll('.byp-term-opt').forEach(lbl => {
    lbl.addEventListener('click', () => {
      const radio = lbl.querySelector('input[type=radio]');
      if (!radio) return;
      radio.checked = true;
      syncAll();
      if (radio.value !== 'month-to-month') unconsent('You changed the pricing plan — please re-read and re-check consent.');
    });
  });

  // ── byp-line-price--incl: grey "Included" style ──
  // (injected via inline style block below)

  // ── Public API ──
  window.resolveEnrollmentPrice = function() {
    const prods = selectedProducts();
    const term  = selectedTerm();
    return resolvePricing(prods, term);
  };

  // ── Add byp-line-price--incl style if not already present ──
  if (!document.getElementById('byp-incl-style')) {
    const s = document.createElement('style');
    s.id = 'byp-incl-style';
    s.textContent = '.byp-line-price--incl{color:#4b2ea6;font-weight:600;font-size:0.82rem;white-space:nowrap;}';
    document.head.appendChild(s);
  }

  syncAll();
})();
