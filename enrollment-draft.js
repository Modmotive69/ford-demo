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
    // Sync modal scroll to inline scroll position (best-effort)
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

  // Escape key closes modal; click on backdrop also closes
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal();
  });
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // Focus trap inside modal
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
    const sel = Array.from(document.querySelectorAll('[name=products]:checked'), x => x.value);
    document.getElementById('print-selected-products').textContent =
      'Selected products: ' + (sel.join(' + ') || 'None');
    document.getElementById('print-configuration').textContent =
      'Configuration: ' + (document.getElementById('configuration').value.trim() || 'Not specified');
    document.getElementById('print-dealership').textContent =
      'Dealership: ' + (document.getElementById('dealer-name').value.trim() || 'Not entered');
    document.getElementById('print-signer').textContent =
      'Name (Signature): ' + (document.getElementById('sig-name').value.trim() || 'Not entered');
    document.getElementById('print-title-val').textContent =
      'Title: ' + (document.getElementById('sig-title').value.trim() || 'Not entered');
    document.getElementById('print-phone-val').textContent =
      'Phone: ' + (document.getElementById('sig-phone').value.trim() || 'Not entered');
    document.getElementById('print-email-val').textContent =
      'Email: ' + (document.getElementById('sig-email').value.trim() || 'Not entered');
    document.getElementById('print-consent').textContent =
      'Consent: ' + (document.getElementById('agree-checkbox').checked
        ? 'Checked in this local draft — not a server acknowledgment'
        : 'Not checked');
  }

  function triggerPrint() {
    syncPrintSummary();
    document.getElementById('print-agreement-only').style.display = 'block';
    window.print();
    // Restore after print dialog dismisses — use afterprint event with a fallback
    const restore = () => {
      document.getElementById('print-agreement-only').style.display = 'none';
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    setTimeout(restore, 8000); // safety fallback
  }

  document.getElementById('btn-print-agreement').addEventListener('click', triggerPrint);
  document.getElementById('modal-btn-print').addEventListener('click', triggerPrint);

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const selected = () => Array.from(document.querySelectorAll('[name=products]:checked'), e => e.value);
  const sigFields = [
    { id: 'sig-name',  label: 'Name (Signature)',  type: 'text'  },
    { id: 'sig-title', label: 'Title',              type: 'text'  },
    { id: 'sig-phone', label: 'Phone',              type: 'tel'   },
    { id: 'sig-email', label: 'Email',              type: 'email' },
  ];
  const phoneRe = /^(?:\+1[ .-]?)?(?:\([0-9]{3}\)|[0-9]{3})[ .-]?[0-9]{3}[ .-]?[0-9]{4}$/;

  /* ── Signing summary (live) ──────────────────────────────────────────── */
  function updateSummary() {
    const v = id => $(id)?.value.trim() || 'Not entered';
    $('signing-summary').textContent =
      `Agreement version: ${version}\n` +
      `Selected products: ${selected().join(' + ') || 'None — choose at least one'}\n` +
      (window._priceSummaryLine ? window._priceSummaryLine + '\n' : '') +
      `Configuration: ${$('configuration').value.trim() || 'Not specified'}\n` +
      `Dealership: ${v('dealer-name')}\n` +
      `Name (Signature): ${v('sig-name')}\n` +
      `Title: ${v('sig-title')}\n` +
      `Phone: ${v('sig-phone')}\n` +
      `Email: ${v('sig-email')}\n` +
      `Consent: ${$('agree-checkbox').checked ? 'Checked in this local draft only — not a server acknowledgment' : 'Not checked'}\n` +
      `Pricing: unresolved — no amount assigned by product selection\n` +
      `Status: REVIEW DRAFT — not submitted or executed`;
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
  form.addEventListener('input', () => { updateSummary(); $('draft-status').textContent = ''; });
  form.addEventListener('change', updateSummary);
  updateSummary();

  /* ── Validation ──────────────────────────────────────────────────────── */
  function validate() {
    const errors = [];
    // Products
    $('product-selection').removeAttribute('aria-invalid');
    $('product-error').textContent = '';
    if (!selected().length) {
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
    // Consent (independent — checked/unchecked does NOT depend on scroll/modal/print)
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

  /* ── Submit: produce local review copy ──────────────────────────────── */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    $('draft-status').textContent = '';
    // Check quote-required FIRST — before field validation, so it shows clearly
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
    // Split signer fields from dealership enrollment fields
    const signerKeys = ['sig_name','sig_title','sig_phone','sig_email'];
    const signer = {};
    for (const k of signerKeys) {
      const mapped = k.replace('sig_','');
      signer[mapped === 'sig_name' ? 'name' : mapped === 'sig_title' ? 'title' : mapped === 'sig_phone' ? 'phone' : 'email'] = (formValues[k] || '').trim();
      delete formValues[k];
    }
    // Also map by id if name differs
    signer.name  = signer.name  || ($('sig-name')  ? $('sig-name').value.trim()  : '');
    signer.title = signer.title || ($('sig-title') ? $('sig-title').value.trim() : '');
    signer.phone = signer.phone || ($('sig-phone') ? $('sig-phone').value.trim() : '');
    signer.email = signer.email || ($('sig-email') ? $('sig-email').value.trim() : '');

    const payload = {
      test: false,
      agreementVersion: agreement.version,
      agreementSha256:  agreement.sha256,
      agreementText:    agreement.terms.join('\n'),
      selectedProducts: selected(),
      pricingSummary:   window.resolveEnrollmentPrice ? window.resolveEnrollmentPrice() : null,
      configuration:    $('configuration') ? $('configuration').value.trim() : '',
      enrollment:       formValues,
      signer:           signer,
      consent: {
        checked:          true,
        text:             agreement.consent,
        capturedAtClient: new Date().toISOString(),
      },
    };

    $('draft-status').textContent = 'Submitting…';
    const submitBtn = form.querySelector('button[type=submit]');
    if (submitBtn) submitBtn.disabled = true;

    let result;
    try {
      const resp = await fetch('/submit-enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      result = await resp.json();
      if (!resp.ok || !result.ok) throw new Error(result.error || `HTTP ${resp.status}`);
    } catch (err) {
      $('draft-status').textContent =
        'Submission failed: ' + err.message +
        ' — your enrollment was NOT sent. Please try again or contact support.';
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    // Show receipt — server acknowledged
    $('draft-status').textContent =
      '✓ Enrollment submitted. Receipt ID: ' + result.receipt_id +
      ' | ' + result.server_timestamp +
      ' | Provider: ' + result.provider +
      (result.is_test ? ' | ⚠ TEST ONLY' : '') +
      ' | Note: ' + result.note;
    if (submitBtn) submitBtn.disabled = false;
  });

})();
