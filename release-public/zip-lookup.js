'use strict';
/**
 * ZIP-first city/state lookup for FordEngage enrollment draft.
 * - Queries api.zippopotam.us (ZIP only, no PII sent)
 * - Stale-response guard: only last-dispatched request can write fields
 * - Leading-zero ZIPs preserved; ZIP+4 stripped to 5-digit base before query
 * - Multiple cities → populated <select>; single city → editable text input
 * - Manual edits to city/state never overwritten after user touches them
 * - Network/no-result → manual fallback, fields remain editable, never blocking
 */
(() => {
  const zipInput    = document.getElementById('zip');
  const citySelect  = document.getElementById('city');
  const cityText    = document.getElementById('city-text');
  const stateSelect = document.getElementById('state');
  const statusEl    = document.getElementById('zip-lookup-status');
  const cityNote    = document.getElementById('city-options-note');
  const zipError    = document.getElementById('zip-error');

  if (!zipInput) return; // not on this page

  // ── State tracking ──────────────────────────────────────────────────────────
  let lookupSeq    = 0;   // stale-response guard: only latest seq can write
  let cityTouched  = false;
  let stateTouched = false;
  let lastQueriedZip = '';

  // Track manual edits
  cityText.addEventListener('input',  () => { cityTouched  = true; });
  citySelect.addEventListener('change', () => { cityTouched = true; });
  stateSelect.addEventListener('change', () => { stateTouched = true; });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function normalizeZip(raw) {
    // Strip non-digits, take first 5 digits (handles ZIP+4 like 48201-1234)
    const digits = raw.replace(/\D/g, '');
    return digits.substring(0, 5);
  }

  function setStatus(msg, cls) {
    statusEl.className = 'zip-status' + (cls ? ' ' + cls : '');
    statusEl.innerHTML = msg;
  }

  function showCityText(value) {
    citySelect.style.display = 'none';
    citySelect.removeAttribute('required');
    cityText.style.display   = '';
    cityText.setAttribute('required', '');
    cityText.name = 'city';
    citySelect.name = '';
    if (value !== undefined && !cityTouched) cityText.value = value;
  }

  function showCitySelect(cities) {
    cityText.style.display   = 'none';
    cityText.removeAttribute('required');
    cityText.name = '';
    citySelect.style.display = '';
    citySelect.setAttribute('required', '');
    citySelect.name = 'city';
    // Rebuild options
    citySelect.innerHTML = '';
    cities.forEach((city, i) => {
      const opt = document.createElement('option');
      opt.value = city; opt.textContent = city;
      citySelect.appendChild(opt);
    });
    if (cities.length > 1) {
      cityNote.style.display = '';
      cityNote.textContent = cities.length + ' postal cities for this ZIP — choose one or type above.';
      // Also offer manual override
      const manualOpt = document.createElement('option');
      manualOpt.value = '__manual__'; manualOpt.textContent = 'Enter manually…';
      citySelect.appendChild(manualOpt);
    } else {
      cityNote.style.display = 'none';
    }
  }

  function setStateValue(abbr) {
    // Try to select the matching option in the existing state <select>
    const opts = Array.from(stateSelect.options);
    const match = opts.find(o => o.value === abbr);
    if (match) {
      stateSelect.value = abbr;
    }
  }

  // Handle "Enter manually…" selection in city select
  citySelect.addEventListener('change', () => {
    if (citySelect.value === '__manual__') {
      showCityText('');
      cityText.focus();
      cityTouched = true;
    }
  });

  // ── Core lookup ──────────────────────────────────────────────────────────────
  async function lookupZip(zip5) {
    const seq = ++lookupSeq;
    lastQueriedZip = zip5;
    // Do NOT reset cityTouched/stateTouched here — preserve manual edits across lookups

    setStatus('<span class="zip-spinner"></span> Looking up ZIP…', 'zip-spin');

    let data;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`https://api.zippopotam.us/us/${zip5}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeout);

      if (!resp.ok) throw new Error('not_found');
      data = await resp.json();
    } catch (err) {
      if (seq !== lookupSeq) return; // stale
      const msg = err.name === 'AbortError' ? 'ZIP lookup timed out' :
                  err.message === 'not_found' ? 'ZIP not found' : 'ZIP lookup unavailable';
      setStatus('⚠ ' + msg + ' — enter city and state manually.', 'zip-err');
      showCityText('');
      return;
    }

    if (seq !== lookupSeq) return; // stale response — discard

    const places = data.places || [];
    if (!places.length) {
      setStatus('⚠ No city found for this ZIP — enter manually.', 'zip-err');
      showCityText(''); return;
    }

    const stateAbbr = data['state abbreviation'] || '';
    const cities    = [...new Set(places.map(p => p['place name']))];

    // State: only write if user hasn't manually changed it
    if (!stateTouched) setStateValue(stateAbbr);

    if (cities.length === 1) {
      showCityText(cities[0]);
      setStatus(`✓ ${cities[0]}, ${stateAbbr}`, 'zip-ok');
    } else {
      showCitySelect(cities);
      setStatus(`✓ ${cities.length} cities for ${zip5}, ${stateAbbr} — choose one`, 'zip-ok');
    }

    zipError.textContent = '';
    zipInput.removeAttribute('aria-invalid');
  }

  // ── ZIP input event handler ──────────────────────────────────────────────────
  let debounceTimer;
  zipInput.addEventListener('input', () => {
    const raw  = zipInput.value;
    const zip5 = normalizeZip(raw);

    // Clear status on blank
    if (!raw.trim()) {
      setStatus('', '');
      showCityText('');
      ++lookupSeq; // invalidate any pending request
      return;
    }

    // Only trigger on a complete 5-digit ZIP (after stripping ZIP+4)
    if (zip5.length < 5) {
      setStatus('', '');
      return;
    }

    // Skip only if same ZIP and already showing a successful result
    if (zip5 === lastQueriedZip && statusEl.classList.contains('zip-ok')) return;

    // Debounce 300ms
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => lookupZip(zip5), 300);
  });

  // Also trigger on paste/blur in case input event didn't fire
  zipInput.addEventListener('change', () => {
    const zip5 = normalizeZip(zipInput.value);
    if (zip5.length === 5 && zip5 !== lastQueriedZip) lookupZip(zip5);
  });

  // ── Signing summary: city/state pulling from active control ─────────────────
  // enrollment-draft.js calls updateSummary() on form input/change events —
  // that reads dealer-name, city (whichever control is active), state, etc.
  // No change needed; the field name="city" and name="state" are preserved.

  // ── Initialise display: city as text input (lookup not yet done) ─────────────
  showCityText('');
  setStatus('', '');
})();
