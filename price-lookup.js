'use strict';
/**
 * price-lookup.js — canonical enrollment pricing + Build Your Plan sync.
 * v review-18: World Domination locked to 2-year term (Scott confirmed 2026-09-28)
 *
 * Two modes:
 *   CUSTOM  — Engage360 always included + any combo of eStore / VDP Widget
 *             Term: month-to-month | 1-year | 2-year (user picks)
 *   PACKAGE — World Domination: all three + 32" 4K kiosk, LOCKED 2-year, $999/mo base
 *             → 25% off = $749.25/mo, setup waived
 *             Selecting WD: clears addon checks; addon tiles show "Included in World Domination"
 *             Term selector hidden; locked notice shown instead
 *             Selecting any addon while WD active exits package mode
 *
 * Server-side enforcement: WD requires term=2year; shorter-term WD submissions rejected.
 *
 * Payload:
 *   CUSTOM:  { products: ['FordEngage', ...addons], term: <selected> }
 *   PACKAGE: { products: ['WorldDomination'],        term: '2year'   }  ← forced server-side
 */
(() => {
  const dataEl = document.getElementById('draft-agreement-data');
  if (!dataEl) return;
  const agreement = JSON.parse(dataEl.textContent);
  const PRICES = agreement.priceConfig;
  const TERMS  = agreement.termConfig;

  const WD_LOCKED_TERM = agreement.wdTermLocked || '2year'; // canonical from agreement-data

  const form       = document.getElementById('enroll-form');
  const consentBox = document.getElementById('agree-checkbox');
  const summaryEl  = document.getElementById('signing-summary');
  if (!form || !consentBox) return;

  const __BYP_DISPLAY_PRICES__ = {
    'FordEngage':  49900,
    'eStore':      29900,
    'VDP Widget':  19900,
  };
  const __BYP_PRODUCT_DETAILS__ = {
    'FordEngage': {
      name: 'FordEngage',
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
      detail: 'All three products in one complete showroom package: Engage360, EnvyPRO eStore, and VDP Widget — plus a 32-inch 4K kiosk, a $1,000 value. 2-year commitment, 25% off monthly, setup waived. Priority support included.',
    },
  };

  const WD_INCLUDED_ADDONS = ['eStore', 'VDP Widget'];

  function fmtC(cents) {
    return '$' + (cents / 100).toFixed(2).replace(/\.00$/, '');
  }
  function combKey(products) { return [...products].sort().join('+'); }

  // ── Mode detection ──
  function isWDMode() {
    return !!document.getElementById('product-wd')?.checked;
  }

  // ── Authoritative product list for payload + pricing ──
  function selectedProducts() {
    if (isWDMode()) return ['WorldDomination'];
    const addons = Array.from(form.querySelectorAll('.addon-input:checked'), e => e.value);
    return ['FordEngage', ...addons];
  }

  // ── Term: WD always returns locked term regardless of radio state ──
  function selectedTerm() {
    if (isWDMode()) return WD_LOCKED_TERM;
    const radio = document.querySelector('#enroll-form input[name="term"]:checked');
    if (radio) return radio.value;
    const sel = document.getElementById('term-select');
    return sel ? sel.value : 'month-to-month';
  }

  // ── Pricing resolution ──
  function resolvePricing(products, termId) {
    if (!products.length) return null;

    if (products.length === 1 && products[0] === 'WorldDomination') {
      // Force locked term regardless of what termId was passed
      const lockedTermId = WD_LOCKED_TERM;
      const entry = PRICES['WorldDomination'];
      if (!entry || entry.price === null) return null;
      const tc        = TERMS[lockedTermId] || TERMS['2year'];
      const baseCents = Math.round(entry.price * 100);
      const discCents = Math.round(baseCents * tc.discountFactor);
      return {
        key:             'WorldDomination',
        products,
        termId:          lockedTermId,         // always 2year
        termLabel:       tc.label,
        termMonths:      tc.termMonths,
        discountPct:     tc.discountPct,
        baseCents,
        baseLabel:       fmtC(baseCents) + '/mo',
        discountedCents: discCents,
        discountedLabel: fmtC(discCents) + '/mo',
        setupCents:      tc.setupCents,        // 0 — setup waived on 2yr
        setupLabel:      tc.setupLabel,
        isWD:            true,
      };
    }

    const key   = combKey(products);
    const entry = PRICES[key];
    if (!entry || entry.price === null) return null;
    const tc         = TERMS[termId] || TERMS['month-to-month'];
    const baseCents  = Math.round(entry.price * 100);
    const discCents  = Math.round(baseCents * tc.discountFactor);
    return {
      key, products, termId,
      termLabel:       tc.label,
      termMonths:      tc.termMonths,
      discountPct:     tc.discountPct,
      baseCents,       baseLabel: fmtC(baseCents) + '/mo',
      discountedCents: discCents, discountedLabel: fmtC(discCents) + '/mo',
      setupCents:      tc.setupCents, setupLabel: tc.setupLabel,
      isWD:            false,
    };
  }

  // ── Term selector visibility: hide when WD mode, show otherwise ──
  function syncTermSelectorVisibility() {
    const wd        = isWDMode();
    const termWrap  = document.querySelector('.byp-term-wrap');
    const termLabel = document.querySelector('.byp-term-label');
    const termNotice = document.getElementById('byp-wd-term-notice');
    if (termWrap)   termWrap.hidden  = wd;
    if (termLabel)  termLabel.hidden = wd;
    if (termNotice) termNotice.hidden = !wd;
    // When entering WD mode, force 2yr radio so form state stays consistent
    if (wd) {
      const r2yr = document.getElementById('term-2yr');
      if (r2yr && !r2yr.checked) r2yr.checked = true;
    }
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

    form.querySelectorAll('label.ptile:not(.ptile--wd)').forEach(tile => {
      const input = tile.querySelector('.addon-input');
      const check = tile.querySelector('.ptile-check');
      const badge = tile.querySelector('.ptile-state-badge');
      if (!input) return;
      if (wd) {
        const included = WD_INCLUDED_ADDONS.includes(input.value);
        tile.classList.remove('is-selected');
        tile.classList.toggle('ptile--wd-included', included);
        if (check) check.className = 'ptile-check ' + (included ? 'ptile-check--on' : 'ptile-check--off');
        if (badge && included) {
          badge.className = 'ptile-state-badge';
          badge.style.background = '#ece6ff'; badge.style.color = '#4b2ea6';
          badge.innerHTML = '<svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true"><path d="M1 4.5l3 3 6-6" stroke="#4b2ea6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> In World Domination';
        }
      } else {
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

    syncTermSelectorVisibility();
    syncTermLabelState();
  }

  function renderLegacySummary(prods, r) {
    const content = document.getElementById('pps-content');
    if (!content) return;
    if (!r) {
      content.style.cssText = 'font-size:0.9rem;color:#555;font-style:italic';
      content.innerHTML = 'No products selected yet.'; return;
    }
    const displayProds = r.isWD
      ? ['Engage360', 'EnvyPRO eStore', 'VDP Widget', '32" 4K Kiosk ($1,000 value)']
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
    if (r.isWD) rows.push(['32" 4K Kiosk', '$1,000 value — included']);
    rows.push(['One-time setup', r.setupCents === 0 ? '<span style="color:#1a7a3c;font-weight:600">Waived</span>' : '<strong>' + r.setupLabel + '</strong>']);
    content.style.cssText = '';
    content.innerHTML = '<table style="border-collapse:collapse;width:100%;font-size:0.9rem">' +
      rows.map(([k,v]) => `<tr><td style="padding:4px 12px 4px 0;color:#555;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:4px 0">${v}</td></tr>`).join('') +
      '</table>';
  }

  function renderBYP(prods, termId) {
    if (!prods)  prods  = selectedProducts();
    if (!termId) termId = selectedTerm();
    const r  = resolvePricing(prods, termId);
    const wd = r?.isWD;

    const hdrName = document.getElementById('byp-hdr-name');
    if (hdrName) hdrName.textContent = wd ? 'World Domination' : prods.map(p => __BYP_PRODUCT_DETAILS__[p]?.name || p).join(' + ');

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
      // WD: components listed as Included, no individual prices shown
      html += `<div class="byp-line"><span class="byp-line-name byp-line-name--base">FordEngage</span><span class="byp-line-price byp-line-price--incl">Included</span></div>`;
      html += `<div class="byp-line"><span class="byp-line-name">EnvyPRO eStore</span><span class="byp-line-price byp-line-price--incl">Included</span></div>`;
      html += `<div class="byp-line"><span class="byp-line-name">VDP Widget</span><span class="byp-line-price byp-line-price--incl">Included</span></div>`;
      html += `<div class="byp-line"><span class="byp-line-name">32" 4K Kiosk</span><span class="byp-line-price byp-line-price--incl">$1,000 value</span></div>`;
      // Show 25% discount line
      const saved = r.baseCents - r.discountedCents;
      html += `<div class="byp-line"><span class="byp-line-name byp-line-name--save">2-year discount (25%)</span><span class="byp-line-price byp-line-price--save">−${fmtC(saved)}/mo</span></div>`;
    } else {
      const addons = prods.filter(p => p !== 'FordEngage');
      html += `<div class="byp-line"><span class="byp-line-name byp-line-name--base">FordEngage</span><span class="byp-line-price">${fmtC(__BYP_DISPLAY_PRICES__['FordEngage'])}/mo</span></div>`;
      addons.forEach(a => {
        html += `<div class="byp-line"><span class="byp-line-name">${__BYP_PRODUCT_DETAILS__[a]?.name || a}</span><span class="byp-line-price">${fmtC(__BYP_DISPLAY_PRICES__[a])}/mo</span></div>`;
      });
      const sumParts = prods.reduce((s,p) => s + (__BYP_DISPLAY_PRICES__[p] || 0), 0);
      const adj = r.baseCents - sumParts;
      if (addons.length && adj < 0) {
        html += `<div class="byp-line"><span class="byp-line-name byp-line-name--save">Bundle adjustment</span><span class="byp-line-price byp-line-price--save">−${fmtC(Math.abs(adj))}/mo</span></div>`;
      }
      if (r.discountPct > 0) {
        const saved = r.baseCents - r.discountedCents;
        html += `<div class="byp-line"><span class="byp-line-name byp-line-name--save">${r.termLabel} discount (${r.discountPct}%)</span><span class="byp-line-price byp-line-price--save">−${fmtC(saved)}/mo</span></div>`;
      }
    }
    cart.innerHTML = html;

    const ta = document.getElementById('byp-total-amount');
    const sub = document.getElementById('byp-total-sub');
    const sv = document.getElementById('byp-setup-val');
    if (ta) ta.textContent = fmtC(r.discountedCents);
    if (sub) sub.textContent = 'per month · billed in arrears · ' + r.termLabel;
    if (sv) {
      if (r.setupCents > 0) { sv.textContent = fmtC(r.setupCents); sv.className = 'byp-setup-val--amount'; }
      else { sv.textContent = 'Waived'; sv.className = 'byp-setup-val--waived'; }
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
      priceStr = r.discountedLabel + ' (' + r.discountPct + '% off base ' + r.baseLabel + ', ' + r.termLabel + ')' +
        (r.setupCents > 0 ? ' + ' + r.setupLabel : ', setup waived');
    } else {
      priceStr = r.discountedLabel + (r.setupCents > 0 ? ' + ' + r.setupLabel : ', setup waived');
    }
    const prodLabel = wd
      ? 'World Domination (FordEngage + EnvyPRO eStore + VDP Widget + 32" 4K Kiosk, $1,000 value) — 2-year commitment'
      : (prods.length ? prods.map(p => __BYP_PRODUCT_DETAILS__[p]?.name || p).join(' + ') : 'None');
    window._priceSummaryLine = 'Pricing plan: ' + (TERMS[termId]?.label || termId) + '\nProduct & Price: ' + prodLabel + ' — ' + priceStr;
    form.dispatchEvent(new Event('input', { bubbles: false }));
  }

  // ── Re-consent ──
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
    } else { lastCheckedCombo = ''; lastCheckedTerm = ''; }
  });

  function syncAll() {
    const prods = selectedProducts();
    const term  = selectedTerm();
    syncProductTileState();
    renderBYP(prods, term);
    renderLegacySummary(prods, resolvePricing(prods, term));
    updateSigningSummary();
  }

  // ── WD input: selecting WD clears addons, locks term to 2yr ──
  const wdInput = document.getElementById('product-wd');
  if (wdInput) {
    wdInput.addEventListener('change', () => {
      if (wdInput.checked) {
        form.querySelectorAll('.addon-input').forEach(cb => { cb.checked = false; });
        // Force 2yr term radio
        const r2yr = document.getElementById('term-2yr');
        if (r2yr) r2yr.checked = true;
      }
      syncAll();
      unconsent('Package selection changed — please re-read and re-check consent.');
    });
  }

  // ── Addon inputs: selecting any addon exits WD mode ──
  form.querySelectorAll('.addon-input').forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked && isWDMode()) {
        if (wdInput) wdInput.checked = false;
      }
      syncAll();
      unconsent('You changed the product selection — please re-read and re-check consent.');
    });
    input.addEventListener('focus', () => input.closest('.ptile, .byp-term-opt')?.classList.add('is-focused'));
    input.addEventListener('blur',  () => input.closest('.ptile, .byp-term-opt')?.classList.remove('is-focused'));
  });

  // ── Term selector: blocked during WD mode ──
  document.querySelectorAll('input[name="term"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (isWDMode()) { radio.checked = (radio.value === WD_LOCKED_TERM); return; }
      syncAll();
      unconsent('You changed the pricing plan — please re-read and re-check consent.');
    });
  });
  document.querySelectorAll('.byp-term-opt').forEach(lbl => {
    lbl.addEventListener('click', () => {
      if (isWDMode()) return; // term locked in WD mode
      const radio = lbl.querySelector('input[type=radio]');
      if (!radio) return;
      radio.checked = true;
      syncAll();
      if (radio.value !== 'month-to-month') unconsent('You changed the pricing plan — please re-read and re-check consent.');
    });
  });

  // ── Public API (used by submission payload + server-side validation) ──
  window.resolveEnrollmentPrice = function() {
    return resolvePricing(selectedProducts(), selectedTerm());
  };
  // Exposed for server-side tamper detection
  window.WD_LOCKED_TERM = WD_LOCKED_TERM;

  // Inline style for Included prices
  if (!document.getElementById('byp-incl-style')) {
    const s = document.createElement('style');
    s.id = 'byp-incl-style';
    s.textContent = '.byp-line-price--incl{color:#4b2ea6;font-weight:600;font-size:0.82rem;white-space:nowrap;}';
    document.head.appendChild(s);
  }

  syncAll();
})();
