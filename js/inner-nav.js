'use strict';
// Inner-page behavior for the unchanged homepage header markup.
(() => {
  const header = document.querySelector('body > nav:not(.sidebar)');
  if (!header) return;
  if (document.body.classList.contains('nav-static-page') || document.body.classList.contains('how-page')) header.classList.add('scrolled');
  if (typeof window.toggleSidebar !== 'function') {
    const menu = document.createElement('dialog');
    menu.className = 'nav-menu-dialog';
    menu.setAttribute('aria-label', 'Site navigation');
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close menu';
    close.addEventListener('click', () => menu.close()); menu.append(close);
    for (const [text, href] of [['Home','index.html'],['How It Works','how-it-works.html'],['Contact Us','contact.html'],['Enroll Now','enroll.html']]) {
      const link = document.createElement('a'); link.textContent = text; link.href = href; menu.append(link);
    }
    const watch = document.createElement('button'); watch.type = 'button'; watch.textContent = 'Watch Video';
    watch.addEventListener('click', () => {menu.close(); window.openVideo();}); menu.append(watch);
    document.body.append(menu);
    window.toggleSidebar = () => menu.open ? menu.close() : menu.showModal();
  }
  if (typeof window.openVideo !== 'function') {
    const dialog = document.createElement('dialog'); dialog.className = 'nav-video-dialog';
    dialog.setAttribute('aria-label','FordEngage program video');
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close video';
    const frame = document.createElement('iframe'); frame.title = 'FordEngage Accessories Sales Program'; frame.allow = 'autoplay; fullscreen';
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => frame.removeAttribute('src'));
    dialog.append(close,frame); document.body.append(dialog);
    window.openVideo = () => {frame.src = 'https://www.youtube-nocookie.com/embed/aHBj-zA7Hqg?autoplay=1&rel=0';dialog.showModal();};
  }
})();
