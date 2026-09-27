(() => {
  'use strict';
  const launch = document.getElementById('fe-full-launch');
  const dialog = document.getElementById('fe-full-dialog');
  if (!launch || !dialog) return;
  const close = document.getElementById('fe-full-close');
  const bottomClose = document.getElementById('fe-full-close-bottom');
  const host = document.getElementById('fe-full-frame-host');
  const status = document.getElementById('fe-full-status');
  let frame, timer, previousFocus, bodyOverflow, rootOverflow;
  const stop = () => { clearTimeout(timer); host.replaceChildren(); frame = null; };
  function open() {
    if (dialog.open) return;
    previousFocus = document.activeElement;
    bodyOverflow = document.body.style.overflow;
    rootOverflow = document.documentElement.style.overflow;
    stop();
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    close.focus({preventScroll:true});
    status.textContent = 'Loading the full experience…';
    status.hidden = false;
    const current = document.createElement('iframe');
    current.title = 'ENGAGE360 full experience';
    current.allow = 'autoplay; fullscreen; xr-spatial-tracking';
    // No cross-origin DOM inspection, cookie exceptions, proxy or framing-policy workaround.
    current.src = 'https://engage.uax.ai';
    const unavailable = () => {
      if (frame !== current || !dialog.open) return;
      status.textContent = 'If the embedded demo is unavailable, open the full experience in a new tab using the link above.';
      status.hidden = false;
    };
    current.addEventListener('load', () => {
      if (frame !== current) return;
      clearTimeout(timer);
      // A cross-origin load event is not proof that every app feature works.
      // Keep the verified feature limitation and independent top-level link visible.
      status.hidden = true;
    }, {once:true});
    current.addEventListener('error', unavailable);
    frame = current;
    host.append(current);
    timer = setTimeout(unavailable, 20000);
  }
  function dismiss() { if (dialog.open) dialog.close(); }
  launch.addEventListener('click', open);
  close.addEventListener('click', dismiss);
  bottomClose.addEventListener('click', dismiss);
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    stop();
    status.hidden = true;
    document.body.style.overflow = bodyOverflow;
    document.documentElement.style.overflow = rootOverflow;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus({preventScroll:true});
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
  // Capture parent Escape before the existing video-modal listener can unlock the page.
  document.addEventListener('keydown', event => {
    if (!dialog.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      dismiss();
    } else if (event.key === 'Tab') {
      // Native modal inertness also contains focus across the cross-origin frame.
      if (event.shiftKey && document.activeElement === close) {
        event.preventDefault(); bottomClose.focus();
      } else if (!event.shiftKey && document.activeElement === bottomClose) {
        event.preventDefault(); close.focus();
      }
    }
  }, true);
  let backdropDown = false;
  const outside = event => {
    const r = dialog.getBoundingClientRect();
    return event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom);
  };
  dialog.addEventListener('pointerdown', event => { backdropDown = outside(event); });
  dialog.addEventListener('click', event => {
    if (backdropDown && outside(event)) dismiss();
    backdropDown = false;
  });
})();
