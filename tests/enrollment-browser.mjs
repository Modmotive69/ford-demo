import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('/opt/homebrew/lib/node_modules/openclaw/node_modules/playwright-core');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const out='/Users/scottanderson/.openclaw/workspace/artifacts/fordengage-agreement-review/submission-verification';mkdirSync(out,{recursive:true});
const live=process.argv.includes('--live');
const base=live?'https://fordengage.livecode.tech':'https://enrollment.test';
const agreement=JSON.parse(readFileSync(root+'/server/agreement.json'));
const source=readFileSync(root+'/functions/submit-enrollment.js','utf8').replace("import agreement from '../server/agreement.json';",`const agreement=${JSON.stringify(agreement)};`);
const {renderAgreement}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const browser=await chromium.launch({headless:true,executablePath:'/Users/scottanderson/Library/Caches/ms-playwright/chromium-1246/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const results=[];
async function fill(page){
 const values={'zip':'48201','dealer-name':'SYNTHETIC QA — NOT A DEALER ENROLLMENT','pa-code':'TEST','address':'123 Test Street','city-text':'Detroit','pc-first':'Synthetic','pc-last':'Tester','pc-email':'scott.anderson@smartdealer.com','sig-name':'Synthetic QA Signer','sig-title':'General Manager','sig-phone':'555-555-0100','sig-email':'scott.anderson@smartdealer.com'};
 for(const [id,value] of Object.entries(values))await page.locator('#'+id).fill(value);
 await page.locator('#state').selectOption('MI');await page.locator('#pc-title').selectOption('General Manager');
 await page.locator('[name=products][value=FordEngage]').check();await page.locator('#agree-checkbox').check();
}
function mockResult(p){const r={receipt_id:'00000000-1111-4222-8333-444444444444',server_timestamp:'2026-09-28T12:00:00.000Z',agreementVersion:agreement.version,agreementSha256:agreement.sha256,agreementText:agreement.terms.join('\n'),selectedProducts:p.selectedProducts,termId:p.termId||'month-to-month',configuration:p.configuration,enrollment:p.enrollment,signer:p.signer,consent:p.consent,resolved_price:{price:499,baseCents:49900,baseLabel:'$499/mo',discountedCents:49900,discountedLabel:'$499/mo',discountPct:0,setupCents:100000,setupLabel:'$1,000 one-time setup',termId:'month-to-month',termLabel:'Month-to-month',termMonths:null,label:'$499/mo + $1,000 one-time setup'},email_recipients:['scott@smartdealer.com','scott.anderson@smartdealer.com'],email_status:'queued'};return {ok:true,...r,agreement_html:renderAgreement(r)};}
try{
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:950},acceptDownloads:true});
  if(!live)await page.route(base+'/**',async route=>{let pathname=new URL(route.request().url()).pathname;if(pathname==='/enroll')pathname='/enroll.html';const f=path.join(root,pathname);if(existsSync(f)){const ext=path.extname(f);await route.fulfill({body:readFileSync(f),contentType:ext==='.html'?'text/html':ext==='.js'?'application/javascript':ext==='.css'?'text/css':'application/octet-stream'});}else await route.fulfill({status:404,body:''});});
  await page.route('https://api.zippopotam.us/**',r=>r.fulfill({status:404,body:'{}'}));
  let calls=0,mode='error',lastPayload;
  await page.route(base+'/submit-enrollment',async route=>{calls++;lastPayload=route.request().postDataJSON();if(mode==='error')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'Synthetic provider failure'})});else if(mode==='network')await route.abort('failed');else {await new Promise(r=>setTimeout(r,250));await route.fulfill({contentType:'application/json',body:JSON.stringify(mockResult(lastPayload))});}});
  await page.goto(base+'/enroll');await page.locator('#inline-agreement p').first().waitFor();
  const text=await page.locator('body').innerText();assert.ok(!/local draft|local JSON|REVIEW DRAFT|localhost|Pricing: unresolved/i.test(text));
  assert.equal(await page.locator('#submit-btn').innerText(),'Submit Agreement');
  const style=await page.locator('#submit-btn').evaluate(el=>({background:getComputedStyle(el).backgroundColor,height:el.getBoundingClientRect().height}));assert.equal(style.background,'rgb(0, 52, 120)');assert.ok(style.height>=48);
  await page.locator('#submit-btn').click();assert.equal(calls,0);assert.ok((await page.locator('#draft-errors').innerText()).includes('Please correct'));
  await fill(page);await page.locator('#pc-email').fill('invalid');await page.locator('#submit-btn').click();assert.equal(calls,0);
  await page.locator('#pc-email').fill('scott.anderson@smartdealer.com');await page.locator('#agree-checkbox').uncheck();await page.locator('#submit-btn').click();assert.equal(calls,0);
  await page.locator('#agree-checkbox').check();await page.locator('#btn-expand-modal').click();assert.equal(await page.locator('#agreement-modal').getAttribute('aria-hidden'),'false');await page.keyboard.press('Escape');assert.equal(await page.locator('#btn-expand-modal').evaluate(el=>el===document.activeElement),true);
  await page.locator('#submit-btn').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#draft-status').textContent.includes('Synthetic provider failure'));assert.equal(calls,1);assert.equal(await page.locator('#submission-confirmation').count(),0);assert.equal(await page.locator('#sig-name').inputValue(),'Synthetic QA Signer');
  mode='network';await page.locator('#submit-btn').click();await page.waitForFunction(()=>document.querySelector('#draft-status').textContent.includes('network error'));assert.equal(await page.locator('#submission-confirmation').count(),0);
  await page.locator('#submit-btn').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${live?'public':'local'}-form-${width}.png`});
  mode='success';await page.locator('#submit-btn').focus();await page.keyboard.press('Enter');await page.evaluate(()=>document.querySelector('#enroll-form').dispatchEvent(new Event('submit',{cancelable:true})));await page.locator('#submission-confirmation').waitFor();assert.equal(calls,3);assert.equal(await page.locator('#enroll-form').isVisible(),false);assert.equal(await page.locator('#submission-confirmation').evaluate(el=>el===document.activeElement),true);
  const confirmation=await page.locator('#submission-confirmation').innerText();for(const value of ['Congratulations—your agreement has been submitted.','$499/mo','Synthetic QA Signer','2026-09-28T12:00:00.000Z','queued','inbox delivery is not confirmed','Month-to-month','one-time setup'])assert.ok(confirmation.includes(value));
  const layout=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth,rect:document.querySelector('#submission-confirmation').getBoundingClientRect().toJSON()}));assert.ok(layout.scroll<=width+1);assert.ok(layout.rect.x>=0&&layout.rect.right<=width+1);
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download Agreement (HTML)',exact:true}).click();const download=await downloadPromise;const dest=`${out}/${live?'public':'local'}-agreement-${width}.html`;await download.saveAs(dest);const html=readFileSync(dest,'utf8');assert.ok(html.includes(agreement.sha256));assert.ok(html.includes(agreement.consent));assert.ok(!html.includes('UNSUBMITTED_REVIEW_DRAFT'));
  await page.evaluate(()=>{window.print=()=>{window.__printed=true;}});await page.getByRole('button',{name:'Print / Save as PDF',exact:true}).click();assert.equal(await page.evaluate(()=>window.__printed),true);assert.ok((await page.locator('#print-agreement-only').textContent()).includes(agreement.terms.at(-1)));await page.emulateMedia({media:'print'});await page.pdf({path:`${out}/${live?'public':'local'}-agreement-${width}.pdf`,format:'Letter',printBackground:true});await page.emulateMedia({media:'screen'});await page.evaluate(()=>dispatchEvent(new Event('afterprint')));
  await page.locator('#submission-confirmation').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:`${out}/${live?'public':'local'}-confirmation-${width}.png`,fullPage:false});
  results.push({width,passed:true,checks:['CTA style','empty validation','invalid email','missing consent','keyboard submit','modal Escape focus','provider failure preserves entries','network failure no success','duplicate submit guard','confirmation focus','responsive no overflow','HTML contents','print/PDF contents'],api:'mocked; no email sent'});await page.close();
 }
 writeFileSync(`${out}/${live?'public':'local'}-ui-results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
