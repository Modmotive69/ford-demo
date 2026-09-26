#!/usr/bin/env python3
"""Safe browser regression: never dispatch enrollment submits or commerce actions."""
import json,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8769'
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 for width in [320,390,768,1440]:
  context=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce')
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  for name in ['index.html','enroll.html','product.html','dealer-agreement.html']:
   response=page.goto(base+'/'+name,wait_until='networkidle');assert response.status==200,(name,response.status)
   page.evaluate('document.fonts.ready');page.wait_for_timeout(200)
   metrics=page.evaluate('''() => ({overflow:document.documentElement.scrollWidth>innerWidth,broken:Array.from(document.images).filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src')),emDash:document.body.innerText.includes('—')})''')
   assert not metrics['emDash'],(name,'em dash')
   assert not metrics['broken'],(name,metrics['broken'])
   if name in ['index.html','enroll.html']:
    assert page.locator('#sidebar').evaluate('(e)=>e.inert')
    cta=page.locator('.site-header .nav-right a').last.bounding_box();assert cta['x']>=0 and cta['x']+cta['width']<=width+1,(width,name,'CTA clipped',cta)
    page.locator('.hamburger-btn').click();page.wait_for_timeout(250);assert page.locator('#sidebar').evaluate('(e)=>!e.inert');page.keyboard.press('Escape');assert page.locator('#sidebar').evaluate('(e)=>e.inert')
   if name=='index.html':
    assert page.locator('#vehicles-sold').input_value()=='100'
    page.locator('#vehicles-sold').evaluate("e=>{e.value='150';e.dispatchEvent(new Event('input'))}")
    assert page.locator('#ann-avg-profit-val').inner_text()=='$449,190'
    page.evaluate('openVideo()');page.wait_for_timeout(100);assert page.locator('#video-modal').evaluate("e=>e.classList.contains('open')");page.keyboard.press('Escape');assert page.locator('#vmodal-iframe').get_attribute('src')==''
   if name=='enroll.html':assert page.locator('#enroll-form input:enabled:not([type=hidden])').count()==0
   if name=='product.html':
    page.locator('.e360-btn').click();page.evaluate('e360Tab(4)');page.locator('.e360-close').click();page.locator('.e360-btn').click();assert page.locator('.e360-panel:visible').count()==1;page.keyboard.press('Escape')
   assert not errors,(width,name,errors)
   results.append({'width':width,'page':name,**metrics})
   Path('test-results').mkdir(exist_ok=True);page.screenshot(path=f'test-results/{width}-{name}.png',full_page=True)
  context.close()
 browser.close()
print(json.dumps(results,indent=2))
