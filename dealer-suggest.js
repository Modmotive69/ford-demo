'use strict';
// Local exact-ZIP directory lookup; no network dependency or enrollment submission.
(() => {
  const form = document.getElementById('enroll-form');
  if (!form) return;
  const get = id => document.getElementById(id);
  const zip = get('zip'), results = get('dealer-results'), status = get('zip-lookup-status');
  const name = get('dealer-name'), pa = get('pa-code');
  const city = get('city'), cityText = get('city-text');
  city.style.display = 'none'; city.required = false; city.name = '';
  cityText.style.display = ''; cityText.required = true; cityText.name = 'city';
  let selected = null;
  let renderedZip = null;
  function sync() {
    get('selected-dealer-name').value = name.value.trim();
    get('selected-pa-code').value = pa.value.trim();
  }
  form.addEventListener('input', sync);
  form.addEventListener('change', sync);
  // Run before the existing submission handler constructs FormData.
  form.addEventListener('submit', sync, true);
  form.addEventListener('formdata', e => {
    e.formData.set('dealer_name', name.value.trim());
    e.formData.set('pa_code', pa.value.trim());
  });
  function lookup() {
    // The blur/change after typing must not replace a button during its click.
    if (zip.value === renderedZip) return;
    renderedZip = zip.value;
    results.replaceChildren();
    if (selected && zip.value !== selected.z) {
      for (const [id,key] of [['dealer-name','n'],['pa-code','pa'],['address','s'],['city-text','c'],['state','st']]) {
        if (get(id).value === selected[key]) get(id).value = '';
      }
      selected = null; sync();
    }
    const valid = /^\d{5}$/.test(zip.value);
    zip.setAttribute('aria-invalid', String(!valid && zip.value.length > 0));
    get('zip-error').textContent = !valid && zip.value ? 'Enter a valid 5-digit ZIP code.' : '';
    status.textContent = '';
    if (!valid) return;
    if (!window.DEALER_ZIP) {
      status.textContent = 'Dealer directory unavailable. Please enter your dealership details below.';
      return;
    }
    const matches = window.DEALER_ZIP[zip.value] || [];
    status.textContent = matches.length ? `${matches.length} dealership${matches.length === 1 ? '' : 's'} found. Select yours below.` : 'No dealerships found for this ZIP. Check the ZIP or enter your dealership details below.';
    for (const dealer of matches) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'dealer-result';
      const heading = document.createElement('strong'); heading.textContent = dealer.n;
      const address = document.createElement('span');
      address.textContent = `${dealer.s}, ${dealer.c}, ${dealer.st} ${dealer.z} · PA: ${dealer.pa}`;
      button.append(heading, address);
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        selected = dealer;
        for (const [id,key] of [['dealer-name','n'],['pa-code','pa'],['address','s'],['city-text','c'],['state','st']]) get(id).value = dealer[key] || '';
        sync();
        results.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
        status.textContent = `Selected: ${dealer.n}`;
        name.dispatchEvent(new Event('input', {bubbles:true}));
      });
      results.append(button);
    }
  }
  zip.addEventListener('input', lookup);
  zip.addEventListener('change', lookup);
  form.addEventListener('reset', () => setTimeout(() => { selected = null; renderedZip = null; sync(); lookup(); }, 0));
  sync(); lookup();
})();
