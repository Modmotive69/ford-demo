import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const require=createRequire(import.meta.url);
const {chromium}=require('/opt/homebrew/lib/node_modules/openclaw/node_modules/playwright-core');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const live=process.argv.includes('--live'), base=live?'https://fordengage.livecode.tech':'https://enrollment.test';
const out='/Users/scottanderson/.openclaw/workspace/artifacts/fordengage-dealer-lookup'+(live?'/live':'/local');mkdirSync(out,{recursive:true});
const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(root+'/functions/api/dealer-correction.js')).toString('base64'));
const db=new DatabaseSync(':memory:');
const env = { ENROLLMENT_DB: { prepare(q) {
 return {
   async run() { db.exec(q); return {}; },
   bind(...args) { return { async run() { return db.prepare(q).run(...args); } }; }
 };
} } };
const payload={original_pacode:'TEST',original_zip:'33157',name:'Synthetic test',street:'123 Test St',city:'Miami',state:'FL',phone:'',email:'',submitted_at:new Date().toISOString()};
const send=async(body,extras={})=>onRequest({env,request:new Request(base+'/api/dealer-correction',{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...extras},body:JSON.stringify(body)})});
assert.equal((await send(payload)).status,200);assert.equal(db.prepare('SELECT count(*) AS n FROM dealer_corrections').get().n,1);
for(const bad of [[],null,{...payload,name:''},{...payload,state:'Florida'},{...payload,email:'bad'},{...payload,original_zip:'3313'},{...payload,phone:4},{...payload,street:'a'.repeat(301)}])assert.equal((await send(bad)).status,400);
assert.equal((await send(payload,{Origin:'https://evil.test'})).status,403);
assert.equal((await send(payload,{'Content-Type':'text/plain'})).status,415);
assert.equal((await send({...payload,name:'a'.repeat(9000)})).status,413);
assert.equal((await onRequest({env,request:new Request(base+'/api/dealer-correction')})).status,405);
console.log('PASS backend: persistence + 12 invalid/method/origin/body checks');
const browser=await chromium.launch({headless:true,executablePath:'/Users/scottanderson/Library/Caches/ms-playwright/chromium-1246/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
try{
for(const width of [1440,390,320]){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(!live)await page.route(base+'/**',async route=>{let pathname=new URL(route.request().url()).pathname;if(pathname==='/enroll')pathname='/enroll.html';const file=path.join(root,pathname);if(existsSync(file)){const ext=path.extname(file);await route.fulfill({body:readFileSync(file),contentType:ext==='.html'?'text/html':ext==='.js'?'application/javascript':ext==='.css'?'text/css':'application/octet-stream'});}else await route.fulfill({status:404,body:''});});
 let correction=null, posts=0;
 await page.route(base+'/api/dealer-correction',async route=>{correction=route.request().postDataJSON();posts++;const response=await send(correction);await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});
 await page.route(base+'/submit-enrollment',route=>{throw new Error('Unexpected enrollment submission');});
 await page.goto(base+'/enroll');await page.waitForFunction(()=>typeof DEALERS!=='undefined');
 assert.equal(await page.evaluate(()=>DEALERS.length),2720);assert.equal(await page.locator('#regionState').count(),0);
 assert.equal(await page.evaluate(()=>parseDealerCSV('\uFEFFName,Zip,Street\r\n"A, ""B""",01234,"line1\nline2"\r\n')[0].Name),'A, "B"');
 await page.screenshot({path:out+`/${width}-hero.png`});
 await page.locator('#heroZip').fill('abc');await page.locator('.dealer-zip-btn').click();assert.equal(await page.locator('#dealerModal').isVisible(),false);
 await page.locator('#heroZip').fill('33131');await page.locator('#heroZip').press('Enter');assert.match(await page.locator('#dealerModalContent').innerText(),/Not Found/i);await page.screenshot({path:out+`/${width}-33131-not-found.png`});await page.keyboard.press('Escape');
 await page.locator('#heroZip').fill('33157');await page.locator('.dealer-zip-btn').click();assert.match(await page.locator('#dealerModalContent').innerText(),/Ford of Kendall/);await page.screenshot({path:out+`/${width}-found.png`});
 await page.getByRole('button',{name:'Edit Details',exact:true}).click();assert.equal(await page.locator('#edit_name').inputValue(),'Ford of Kendall, LLC');await page.screenshot({path:out+`/${width}-edit.png`});
 await page.locator('#edit_email').fill('qa@example.com');await page.getByRole('button',{name:'Confirm & Continue',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('dealerModal').classList.contains('active'));
 assert.equal(posts,1);assert.equal(correction.original_pacode,'02650');assert.equal(correction.email,'qa@example.com');
 const form=await page.evaluate(()=>Object.fromEntries(new FormData(document.getElementById('enroll-form'))));assert.equal(form.dealer_name,'Ford of Kendall, LLC');assert.equal(form.pa_code,'02650');assert.equal(form.city,'Miami');assert.equal(form.zip,'33157');assert.equal(form.pc_email,'qa@example.com');
 assert.equal(await page.locator('#state').inputValue(),'FL');assert.equal(await page.locator('.prepopulated').count(),8);
 assert.equal(await page.locator('#dealer-name').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(232, 240, 255)');
 assert.ok(await page.locator('#heroZip').evaluate(el=>el.getBoundingClientRect().width)<=170);
 await page.screenshot({path:out+`/${width}-prepopulated.png`});
 await page.locator('#dealer-name').fill('Manual edit');assert.equal(await page.locator('#selected-dealer-name').inputValue(),'Manual edit');
 await page.locator('#heroZip').fill('92335');await page.locator('.dealer-zip-btn').click();assert.equal(await page.locator('.dm-list-item').count(),2);await page.locator('.dm-list-item').first().click();await page.getByRole('button',{name:'Yes — Enroll This Dealership',exact:true}).click();assert.equal(posts,1);
 await page.locator('#heroZip').fill('33131');await page.locator('.dealer-zip-btn').click();await page.getByRole('button',{name:'Continue to Form',exact:true}).click();assert.equal(await page.locator('#dealer-name').inputValue(),'');assert.equal(await page.locator('#selected-pa-code').inputValue(),'');assert.equal(await page.locator('#zip').inputValue(),'33131');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS',width,'CSV/invalid/no-match/single/edit/correction/FormData/multiple/stale-clear/no-overflow/no-JS-errors');await page.close();
}
}finally{await browser.close();}
writeFileSync(out+'/results.txt','PASS backend persistence and validation; 1440/390/320px lookup flows. Browser correction requests intercepted and persisted in local SQLite; no real enrollment or correction test data submitted.\n');
