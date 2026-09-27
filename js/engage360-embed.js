(() => {
  'use strict';
  const send = message => { if (parent !== window) parent.postMessage(message, location.origin); };
  const modal = document.getElementById('e360modal');
  const model = document.getElementById('e360-mv');
  const notice = document.getElementById('fe-viewer-notice');
  let modelDeadline;
  function unavailable() {
    clearTimeout(modelDeadline);
    finishMVLoader();
    notice.hidden = false;
    e360Tab(1);
  }
  model.addEventListener('error', unavailable);
  model.addEventListener('load', () => { clearTimeout(modelDeadline); notice.hidden = true; });
  document.addEventListener('error', e => {
    if (e.target.tagName === 'SCRIPT' && e.target.src.includes('model-viewer')) unavailable();
  }, true);
  document.querySelector('.e360-close').onclick = () => send('fe-viewer-close');
  modal.onclick = e => { if (e.target === modal) send('fe-viewer-close'); };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); send('fe-viewer-close'); }
  });
  document.querySelectorAll('.e360-tab').forEach(tab => {
    tab.tabIndex = 0;
    tab.setAttribute('role','button');
    tab.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tab.click(); }
    });
  });
  // This embedded preview cannot initiate a cart transaction. Product page is untouched.
  const cart = document.querySelector('.e360-atc');
  cart.disabled = true;
  cart.title = 'Preview only';
  modelDeadline = setTimeout(unavailable, 30000);
  openE360();
  e360Tab(0);
  send('fe-viewer-ready');
})();
