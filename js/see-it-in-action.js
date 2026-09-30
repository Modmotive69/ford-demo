(() => {
  'use strict';
  const host = document.getElementById('fe-demo-inline');
  if (!host) return;
  const status = host.querySelector('.fe-demo-status');
  const message = status.querySelector('p');
  const retry = host.querySelector('.fe-demo-retry');
  let frame, timer;
  function failure() {
    host.setAttribute('aria-busy', 'false');
    message.textContent = 'The viewer could not load. Please try again.';
    status.hidden = false;
    retry.hidden = false;
  }
  function load() {
    clearTimeout(timer);
    if (frame) frame.remove();
    host.setAttribute('aria-busy', 'true');
    status.hidden = false;
    retry.hidden = true;
    message.textContent = 'Loading viewer…';
    frame = document.createElement('iframe');
    frame.className = 'fe-demo-frame';
    frame.title = 'ENGAGE360 inline interactive viewer';
    frame.allow = 'autoplay; fullscreen; xr-spatial-tracking';
    frame.src = 'engage360-viewer.html';
    frame.addEventListener('error', failure);
    host.append(frame);
    timer = setTimeout(failure, 15000);
  }
  retry.addEventListener('click', load);
  window.addEventListener('message', e => {
    if (!frame || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    if (e.data === 'fe-viewer-ready') {
      clearTimeout(timer);
      status.hidden = true;
      host.setAttribute('aria-busy', 'false');
    }
  });
  // Starts automatically as the inline section approaches the viewport; never needs a launch click.
  // Load immediately if already in view, otherwise observe
  const rect = host.getBoundingClientRect();
  if (rect.top < window.innerHeight + 300) {
    load();
  } else if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
    }, {rootMargin:'300px'});
    observer.observe(host);
  } else { load(); }
  document.querySelector('#sidebar a[href="#see-it-in-action"]').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
    document.body.style.overflow = '';
  });
})();
