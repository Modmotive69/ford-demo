'use strict';
(() => {
  /* ── Data ───────────────────────────────────────────────────────────── */
  const dataEl = document.getElementById('draft-agreement-data');
  const agreement = JSON.parse(dataEl.textContent);
  const version = agreement.version;
  const consentText = agreement.consent;

  /* ── Agreement HTML builder (shared by inline, modal, print) ────────── */
  function buildAgreementHTML(terms) {
    return terms.map(t => {
      if (!t.trim()) return '';
      const isHeading = t.length < 95 && /^[A-Z0-9(]/.test(t.trim());
      const isNotice = t.startsWith('REVIEW') || t.startsWith('Review note');
      const cls = isNotice ? 'ag-notice' : isHeading ? 'ag-heading' : '';
      const tag = isHeading ? 'div' : 'p';
      return `<${tag}${cls ? ` class="${cls}"` : ''}>${t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</${tag}>`;
    }).join('');
  }

  const agreeHTML = buildAgreementHTML(agreement.terms);

  /* ── Populate inline scroll box ─────────────────────────────────────── */
  const inlineBox = document.getElementById('inline-agreement');
  inlineBox.innerHTML = agreeHTML;

  /* ── Populate modal body ────────────────────────────────────────────── */
  const modalBody = document.getElementById('modal-agreement-body');
  modalBody.innerHTML = agreeHTML;

  /* ── Populate print div ──────────────────────────────────────────────── */
  document.getElementById('print-terms-body').innerHTML = agreeHTML;
  document.getElementById('print-version').textContent = version;
  document.getElementById('print-version-footer').textContent = version;

  /* ── Modal open/close ───────────────────────────────────────────────── */
  const modal = document.getElementById('agreement-modal');
  let lastFocusBeforeModal = null;

  function openModal() {
    lastFocusBeforeModal = document.activeElement;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const ratio = inlineBox.scrollTop / Math.max(1, inlineBox.scrollHeight - inlineBox.clientHeight);
    modalBody.scrollTop = ratio * Math.max(0, modalBody.scrollHeight - modalBody.clientHeight);
    const firstFocusable = modal.querySelector('button, [tabindex="0"]');
    if (firstFocusable) firstFocusable.focus();
  }

  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocusBeforeModal) lastFocusBeforeModal.focus();
  }

  document.getElementById('btn-expand-modal').addEventListener('click', openModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal();
  });
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  modal.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || modal.getAttribute('aria-hidden') !== 'false') return;
    const focusable = Array.from(modal.querySelectorAll(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href], input, select, textarea'
    )).filter(el => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
  });

  /* ── Print ───────────────────────────────────────────────────────────── */
  function syncPrintSummary() {
    // Base via hidden input + checked addon-inputs
  const addonSel = Array.from(document.querySelectorAll('.addon-input:checked'), x => x.value);
  const sel = ['FordEngage', ...addonSel];
    const termEl = document.getElementById('term-select');
    const termId = termEl ? termEl.value : 'month-to-month';
    const priceInfo = window.resolveEnrollmentPrice ? window.resolveEnrollmentPrice() : null;
    document.getElementById('print-selected-products').textContent =
      'Selected products: ' + (sel.join(' + ') || 'None');
    const termRow = document.getElementById('print-term-val');
    if (termRow) termRow.textContent = 'Term: ' + (termEl ? termEl.options[termEl.selectedIndex]?.text : 'Month-to-month');
    const priceRow = document.getElementById('print-price-val');
    if (priceRow && priceInfo && !priceInfo.isQuote) {
      priceRow.textContent = 'Monthly fee: ' + priceInfo.discountedLabel +
        (priceInfo.discountPct > 0 ? ' (' + priceInfo.discountPct + '% off ' + priceInfo.baseLabel + ')' : '') +
        ' — Setup: ' + (priceInfo.setupCents === 0 ? 'Waived' : priceInfo.setupLabel);
    } else if (priceRow) {
      priceRow.textContent = priceInfo && priceInfo.isQuote ? 'Pricing: Contact sales for custom quote' : '';
    }
    document.getElementById('print-dealership').textContent =
      'Dealership: ' + (document.getElementById('dealer-name').value.trim() || 'Not entered');
    document.getElementById('print-signer').textContent =
      'Authorized signer: ' + (document.getElementById('sig-name').value.trim() || 'Not entered');
    document.getElementById('print-title-val').textContent =
      'Title: ' + (document.getElementById('sig-title').value.trim() || 'Not entered');
    document.getElementById('print-phone-val').textContent =
      'Phone: ' + (document.getElementById('sig-phone').value.trim() || 'Not entered');
    document.getElementById('print-email-val').textContent =
      'Email: ' + (document.getElementById('sig-email').value.trim() || 'Not entered');
    document.getElementById('print-consent').textContent =
      'Consent: ' + (document.getElementById('agree-checkbox').checked
        ? 'Authorized and agreed — not yet submitted'
        : 'Not yet checked');
    const esigName   = document.getElementById('print-esig-name');
    const esigDealer = document.getElementById('print-esig-dealer');
    const esigTime   = document.getElementById('print-esig-time');
    const sigName  = document.getElementById('sig-name').value.trim()  || '(not entered)';
    const dealerName = document.getElementById('dealer-name').value.trim() || '(not entered)';
    if (esigName)   esigName.textContent   = sigName;
    if (esigDealer) esigDealer.textContent = dealerName;
    if (esigTime)   esigTime.textContent   = new Date().toLocaleString() + ' (device clock — pre-submission review only)';
  }

  function triggerPrint() {
    syncPrintSummary();
    document.getElementById('print-agreement-only').style.display = 'block';
    window.print();
    const restore = () => {
      document.getElementById('print-agreement-only').style.display = 'none';
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    setTimeout(restore, 8000);
  }

  document.getElementById('btn-print-agreement').addEventListener('click', triggerPrint);
  document.getElementById('modal-btn-print').addEventListener('click', triggerPrint);

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const selected = () => {
    const addons = Array.from(document.querySelectorAll('.addon-input:checked'), e => e.value);
    return ['FordEngage', ...addons];
  };
  const sigFields = [
    { id: 'sig-name',  label: 'Name (Signature)',  type: 'text'  },
    { id: 'sig-title', label: 'Title',              type: 'text'  },
    { id: 'sig-phone', label: 'Phone',              type: 'tel'   },
    { id: 'sig-email', label: 'Email',              type: 'email' },
  ];
  const phoneRe = /^(?:\+1[ .-]?)?(?:\([0-9]{3}\)|[0-9]{3})[ .-]?[0-9]{3}[ .-]?[0-9]{4}$/;

  /* ── Shared summary table renderer ──────────────────────────────────── */
  /**
   * Renders rows into a <tbody> as a two-column th/td table.
   * rows: Array of { label, value, icon? }
   *   icon: FA icon class string e.g. 'fa-solid fa-square-check'
   *         Omit for plain rows. 'check' shorthand = fa-solid fa-square-check in ford-blue.
   *   value: string; empty/null renders as em-dash placeholder.
   * FA icons are aria-hidden=true + decorative; value text is the real content.
   * Falls back gracefully when FA is unavailable (icon <i> renders invisible, text still present).
   */
  function renderSummaryRows(tbody, rows) {
    tbody.innerHTML = '';
    for (const { label, value, icon } of rows) {
      const tr = document.createElement('tr');

      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = label;

      const td = document.createElement('td');
      if (icon) {
        const iconEl = document.createElement('i');
        const cls = icon === 'check' ? 'fa-solid fa-square-check' : icon;
        iconEl.className = cls + ' ss-icon';
        iconEl.setAttribute('aria-hidden', 'true');
        td.appendChild(iconEl);
        // Plain-text fallback visible when FA CSS is not loaded (print/email)
        const fallback = document.createElement('span');
        fallback.className = 'ss-icon-fallback';
        fallback.textContent = '☑ ';
        td.appendChild(fallback);
      }
      const textNode = document.createTextNode(value || '—');
      td.appendChild(textNode);

      tr.appendChild(th);
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  /* ── Live signing summary ────────────────────────────────────────────── */
  function updateSummary() {
    const v = id => $(id)?.value.trim() || '';
    const prods = selected();
    const consentChecked = $('agree-checkbox').checked;

    const tbody = $('ss-tbody');
    if (!tbody) return; // guard: element might not exist

    const rows = [
      { label: 'Agreement version', value: version },
      { label: 'Selected products', value: prods.map(p => p === 'FordEngage' ? 'Engage360' : p === 'eStore' ? 'EnvyPRO eStore' : p).join(' + ') },
    ];

    // Insert pricing line if price-lookup.js has computed it
    if (window._priceSummaryLine) {
      // _priceSummaryLine is "Pricing plan: X\nProduct & Price: Y — Z"
      for (const line of window._priceSummaryLine.split('\n')) {
        const sep = line.indexOf(':');
        if (sep < 0) continue;
        rows.push({ label: line.slice(0, sep).trim(), value: line.slice(sep + 1).trim() });
      }
    }

    rows.push(
      { label: 'Dealership',        value: v('dealer-name') || 'Not entered' },
      { label: 'Name (Signature)',   value: v('sig-name')    || 'Not entered' },
      { label: 'Title',             value: v('sig-title')   || 'Not entered' },
      { label: 'Phone',             value: v('sig-phone')   || 'Not entered' },
      { label: 'Email',             value: v('sig-email')   || 'Not entered' },
      {
        label: 'Authorization',
        value: consentChecked ? 'Authorized and agreed — not yet submitted' : 'Not yet checked',
        icon: consentChecked ? 'check' : undefined,
      },
      { label: 'Status', value: 'Ready for submission after validation' },
    );

    renderSummaryRows(tbody, rows);
  }

  /* ── Clear per-field errors on input ────────────────────────────────── */
  for (const { id } of sigFields) {
    const el = $(id);
    if (el) el.addEventListener('input', () => {
      el.removeAttribute('aria-invalid');
      const errEl = $(`${id}-error`);
      if (errEl) errEl.textContent = '';
    });
  }
  const agreeCheckbox = $('agree-checkbox');
  agreeCheckbox.addEventListener('change', () => {
    agreeCheckbox.removeAttribute('aria-invalid');
    $('agree-checkbox-error').textContent = '';
  });

  /* ── Form events ─────────────────────────────────────────────────────── */
  const form = document.getElementById('enroll-form');
  form.addEventListener('input',  () => { updateSummary(); $('draft-status').textContent = ''; });
  form.addEventListener('change', updateSummary);

  /* Reconsent: uncheck agree-checkbox when addon selection or term changes.
     Base (Engage360) is fixed — only addon/term changes require re-consent. */
  function requireReconsent() {
    const cb = $('agree-checkbox');
    if (cb && cb.checked) {
      cb.checked = false;
      cb.dispatchEvent(new Event('change'));
      $('agree-checkbox-error').textContent = 'Please re-read and re-confirm your agreement after changing products or terms.';
    }
  }
  document.querySelectorAll('.addon-input').forEach(inp => {
    inp.addEventListener('change', requireReconsent);
  });
  const termSelectEl = document.getElementById('term-select');
  if (termSelectEl) termSelectEl.addEventListener('change', requireReconsent);

  updateSummary();

  /* ── Validation ──────────────────────────────────────────────────────── */
  function validate() {
    const errors = [];
    for (const el of form.querySelectorAll('input[required], select[required]')) {
      if (el.id === 'city' && el.style.display === 'none') continue;
      if (el.id === 'city-text' && el.style.display === 'none') continue;
      if (!el.validity.valid) { errors.push('Complete a valid ' + (form.querySelector('label[for="' + el.id + '"]')?.textContent || el.name) + '.'); el.setAttribute('aria-invalid','true'); }
    }
    // Products — Engage360 base always included; no empty-selection possible
    $('product-selection').removeAttribute('aria-invalid');
    $('product-error').textContent = '';
    if (false) {
      // unreachable — base always in selectedProducts via hidden input
      errors.push('Choose at least one product.');
      $('product-error').textContent = 'Choose at least one product.';
      $('product-selection').setAttribute('aria-invalid', 'true');
    }
    // Signer fields
    for (const { id, label, type } of sigFields) {
      const el = $(id); if (!el) continue;
      const errEl = $(`${id}-error`);
      el.removeAttribute('aria-invalid');
      if (errEl) errEl.textContent = '';
      const val = el.value.trim();
      if (!val) {
        errors.push(`${label} is required.`);
        el.setAttribute('aria-invalid', 'true');
        if (errEl) errEl.textContent = `${label} is required.`;
      } else if (type === 'email' && !el.validity.valid) {
        errors.push('Enter a valid email address.');
        el.setAttribute('aria-invalid', 'true');
        if (errEl) errEl.textContent = 'Enter a valid email address.';
      } else if (type === 'tel' && !phoneRe.test(val)) {
        errors.push('Enter a valid 10-digit phone number, e.g. 555-555-0100.');
        el.setAttribute('aria-invalid', 'true');
        if (errEl) errEl.textContent = 'Enter a valid 10-digit phone, e.g. 555-555-0100.';
      }
    }
    // Consent
    agreeCheckbox.removeAttribute('aria-invalid');
    $('agree-checkbox-error').textContent = '';
    if (!agreeCheckbox.checked) {
      errors.push('Read the terms and check the authorization and agreement checkbox.');
      agreeCheckbox.setAttribute('aria-invalid', 'true');
      $('agree-checkbox-error').textContent = 'Read the terms and check the authorization and agreement checkbox.';
    }
    const errSummary = $('draft-errors');
    errSummary.textContent = errors.length ? 'Please correct: ' + errors.join(' ') : '';
    if (errors.length) errSummary.focus();
    return !errors.length;
  }

  let sending = false;
  let submitted = false;
  let submissionId = crypto.randomUUID();
  let lastPayload = null;
  let accepted = null;

  /* ── Confirmation panel (post-submit) ───────────────────────────────── */
  function showConfirmation(result) {
    accepted = result;
    submitted = true;
    form.hidden = true;

    const panel = document.createElement('section');
    panel.id = 'submission-confirmation';
    panel.tabIndex = -1;
    panel.style.cssText = 'padding:28px 0;overflow-wrap:anywhere';

    const heading = document.createElement('h2');
    heading.textContent = 'Congratulations—your agreement has been submitted.';
    panel.append(heading);

    // Build confirmation table using the shared renderer
    const rp = result.resolved_price;
    const confirmRows = [
      { label: 'Electronically signed by', value: result.signer.name + ' (' + result.signer.title + ')', icon: 'check' },
      { label: 'On behalf of',             value: result.enrollment.dealer_name,                          icon: 'check' },
      { label: 'Products',                 value: result.selectedProducts.join(' + '),                    icon: 'check' },
      { label: 'Pricing plan',             value: rp.termLabel,                                           icon: 'check' },
      { label: 'Base monthly',             value: rp.baseLabel },
    ];
    if (rp.discountPct > 0) {
      confirmRows.push({ label: 'Discount',             value: rp.discountPct + '%' });
      confirmRows.push({ label: 'Discounted monthly',   value: rp.discountedLabel, icon: 'check' });
    } else {
      confirmRows.push({ label: 'Monthly fee',          value: rp.discountedLabel, icon: 'check' });
    }
    confirmRows.push(
      { label: 'One-time setup',    value: rp.setupCents === 0 ? 'Waived' : rp.setupLabel, icon: 'check' },
      { label: 'Accepted (UTC)',    value: result.server_timestamp,  icon: 'check' },
      { label: 'Receipt',          value: result.receipt_id,         icon: 'check' },
      { label: 'Agreement version', value: result.agreementVersion }
    );

    const tableWrap = document.createElement('div');
    tableWrap.className = 'ss-wrap';
    tableWrap.style.marginBottom = '20px';
    const table = document.createElement('table');
    table.className = 'ss-table';
    const tbody = document.createElement('tbody');
    renderSummaryRows(tbody, confirmRows);
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    panel.append(tableWrap);

    const email = document.createElement('p');
    email.textContent = 'Agreement copies are queued for ' + result.email_recipients.join(' and ') + '. The email provider accepted the request; inbox delivery is not confirmed.';
    panel.append(email);

    const download = document.createElement('button');
    download.type = 'button'; download.className = 'btn-submit';
    download.textContent = 'Download Agreement (HTML)';
    download.addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([accepted.agreement_html], {type:'text/html;charset=utf-8'}));
      const a = document.createElement('a'); a.href = url; a.download = 'FordEngage-Agreement-' + accepted.receipt_id + '.html'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
    panel.append(download);

    const print = document.createElement('button'); print.type = 'button'; print.className = 'agreement-btn';
    print.textContent = 'Print / Save as PDF'; print.style.marginTop = '16px';
    print.addEventListener('click', () => {
      const target = $('print-agreement-only');
      const doc = new DOMParser().parseFromString(accepted.agreement_html,'text/html');
      target.innerHTML = doc.body.innerHTML;
      target.style.display = 'block';
      const restore = () => { target.style.display = 'none'; window.removeEventListener('afterprint', restore); };
      window.addEventListener('afterprint', restore);
      window.print();
    });
    panel.append(print);

    const note = document.createElement('p');
    note.textContent = 'Keep this receipt and agreement for your records. Submission does not confirm service activation. PartSites will be in contact to complete onboarding.';
    panel.append(note);

    form.after(panel); panel.focus(); panel.scrollIntoView({block:'start',behavior:'instant'});
  }

  /* Submit — no changes to validation/payload/re-consent logic */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (sending || submitted) return;
    $('draft-status').textContent = '';
    const priceInfo = window.resolveEnrollmentPrice ? window.resolveEnrollmentPrice() : null;
    if (priceInfo && priceInfo.isQuoteRequired) {
      $('draft-status').textContent =
        'This product combination requires a custom quote and cannot be submitted directly. ' +
        'Please contact the sales team.';
      return;
    }
    if (!validate()) return;
    const formValues = Object.fromEntries(new FormData(form));
    delete formValues.products;
    formValues.city = ($('city').style.display === 'none' ? $('city-text').value : $('city').value).trim();
    const signerKeys = ['sig_name','sig_title','sig_phone','sig_email'];
    const signer = {};
    for (const k of signerKeys) {
      const mapped = k.replace('sig_','');
      signer[mapped === 'sig_name' ? 'name' : mapped === 'sig_title' ? 'title' : mapped === 'sig_phone' ? 'phone' : 'email'] = (formValues[k] || '').trim();
      delete formValues[k];
    }
    signer.name  = signer.name  || ($('sig-name')  ? $('sig-name').value.trim()  : '');
    signer.title = signer.title || ($('sig-title') ? $('sig-title').value.trim() : '');
    signer.phone = signer.phone || ($('sig-phone') ? $('sig-phone').value.trim() : '');
    signer.email = signer.email || ($('sig-email') ? $('sig-email').value.trim() : '');

    const termEl = document.getElementById('term-select');
    const termId = termEl ? termEl.value : 'month-to-month';
    const payload = {
      submissionId,
      termId,
      website: formValues.website || '',
      agreementVersion: agreement.version,
      agreementSha256:  agreement.sha256,
      agreementText:    agreement.terms.join('\n'),
      selectedProducts: selected(),
      pricingSummary:   window.resolveEnrollmentPrice ? window.resolveEnrollmentPrice() : null,
      enrollment:       formValues,
      signer:           signer,
      consent: {
        checked:          true,
        text:             agreement.consent,
        capturedAtClient: new Date().toISOString(),
      },
    };

    const identity = JSON.stringify({...payload, submissionId:undefined, consent:{...payload.consent,capturedAtClient:undefined}});
    if (lastPayload && identity !== lastPayload) {
      $('draft-status').textContent = 'Your previous attempt needs a status check. Restore those entries and retry, or contact support before submitting a different agreement.';
      return;
    }
    lastPayload = identity;
    sending = true;
    $('draft-status').textContent = 'Submitting…';
    form.setAttribute('aria-busy','true');
    const submitBtn = form.querySelector('button[type=submit]');
    if (submitBtn) {submitBtn.disabled = true; submitBtn.textContent = 'Submitting…';}

    let result;
    try {
      const resp = await fetch('/submit-enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      result = await resp.json();
      if (!resp.ok || !result.ok) {
        if ([400,413,415,429].includes(resp.status)) lastPayload = null;
        throw new Error((result.error || `HTTP ${resp.status}`) + (result.receipt_id ? ' Receipt: ' + result.receipt_id : ''));
      }
      if (!result.receipt_id || !result.server_timestamp || !result.agreement_html || result.email_status !== 'queued') throw new Error('Server confirmation is incomplete.');
    } catch (err) {
      $('draft-status').textContent = 'Submission not confirmed: ' + err.message + ' Your entries are preserved. Retry checks the same submission; a network error does not prove that no email was queued.';
      sending = false;
      form.removeAttribute('aria-busy');
      if (submitBtn) {submitBtn.disabled = false; submitBtn.textContent = 'Check / Retry Submission';}
      return;
    }
    sending = false;
    form.removeAttribute('aria-busy');
    showConfirmation(result);
  });

})();
