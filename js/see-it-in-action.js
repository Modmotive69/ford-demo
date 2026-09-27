(() => {
  'use strict';
  const launch = document.getElementById('fe-demo-launch');
  const dialog = document.getElementById('fe-demo-dialog');
  if (!launch || !dialog) return;
  const status = dialog.querySelector('.fe-demo-status');
  const message = status.querySelector('p');
  const retry = dialog.querySelector('.fe-demo-retry');
  let frame, timer, previousOverflow;
  function failure() {
    message.textContent = 'The viewer could not load. Please try again.';
    status.hidden = false;
    retry.hidden = false;
  }
  function load() {
    clearTimeout(timer);
    if (frame) frame.remove();
    status.hidden = false;
    retry.hidden = true;
    message.textContent = 'Loading viewer…';
    frame = document.createElement('iframe');
    frame.className = 'fe-demo-frame';
    frame.title = 'ENGAGE360 interactive viewer';
    frame.allow = 'autoplay; fullscreen; xr-spatial-tracking';
    frame.src = 'engage360-viewer.html';
    frame.addEventListener('error', failure);
    dialog.append(frame);
    timer = setTimeout(failure, 15000);
  }
  launch.addEventListener('click', () => {
    previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    load();
    dialog.querySelector('.fe-demo-close').focus();
  });
  dialog.querySelector('.fe-demo-close').addEventListener('click', () => dialog.close());
  retry.addEventListener('click', load);
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    clearTimeout(timer);
    if (frame) frame.remove();
    frame = null;
    document.body.style.overflow = previousOverflow;
    launch.focus({preventScroll:true});
  });
  window.addEventListener('message', e => {
    if (!frame || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    if (e.data === 'fe-viewer-ready') { clearTimeout(timer); status.hidden = true; }
    if (e.data === 'fe-viewer-close') dialog.close();
  });
  document.querySelector('#sidebar a[href="#see-it-in-action"]').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
    document.body.style.overflow = '';
  });
})();
