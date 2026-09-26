'use strict';
// No personal data collection. Keyboard support for existing presentation controls.
document.addEventListener('DOMContentLoaded',()=>{
 const main=document.querySelector('.page-body, .hero');
 if(main){main.id=main.id||'main-content';main.setAttribute('role','main');const skip=document.createElement('a');skip.className='skip-link';skip.href='#'+main.id;skip.textContent='Skip to content';document.body.prepend(skip);}
 document.querySelectorAll('.sidebar-link-soon').forEach(el=>{el.removeAttribute('href');el.setAttribute('aria-disabled','true');});
 document.querySelectorAll('[onclick]').forEach(el=>{if(!['BUTTON','A','INPUT'].includes(el.tagName)&&!el.closest('fieldset[disabled]')&&!el.classList.contains('sidebar-overlay')&&!el.classList.contains('e360-overlay')){el.tabIndex=0;el.setAttribute('role','button');el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});}});
 const drawer=document.getElementById('sidebar'), menu=document.querySelector('.hamburger-btn');
 const dialogs=[drawer,document.getElementById('video-modal'),document.getElementById('e360modal')].filter(Boolean);
 dialogs.forEach(dialog=>{
  let previous=null, background=[];
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',dialog===drawer?'Site navigation':'Media viewer');
  const sync=()=>{const open=dialog.classList.contains('open');dialog.inert=!open;dialog.setAttribute('aria-hidden',String(!open));if(dialog===drawer&&menu){menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-controls',drawer.id);}
   if(open&&!previous){previous=document.activeElement; background=Array.from(document.body.children).filter(el=>el!==dialog&&!el.contains(dialog)&&!el.classList.contains('sidebar-overlay')&&el.tagName!=='SCRIPT').map(el=>[el,el.inert]);background.forEach(([el])=>el.inert=true);(dialog.querySelector('button,a[href],[tabindex="0"]')||dialog).focus();}
   if(!open&&previous){background.forEach(([el,state])=>el.inert=state);previous.focus();previous=null;}
  };new MutationObserver(sync).observe(dialog,{attributes:true,attributeFilter:['class']});sync();
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){dialog.classList.remove('open');document.getElementById('sidebar-overlay')?.classList.remove('open');document.body.style.overflow='';if(typeof stopAutoRotate==='function')stopAutoRotate();dialog.querySelectorAll('video').forEach(v=>v.pause());}if(e.key==='Tab'){const items=Array.from(dialog.querySelectorAll('button,a[href],[tabindex="0"],input')).filter(el=>el.getClientRects().length&&!el.disabled);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden){document.querySelectorAll('video').forEach(v=>v.pause());if(typeof stopAutoRotate==='function')stopAutoRotate();}});
});
