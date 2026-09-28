/**
 * scroll-verify.mjs — verifies the inline agreement box and expanded modal
 * actually scroll (scrollTop changes, last clause reachable) at 390 and 1440.
 * No mock submissions; no email calls. Tests the CSS/layout only.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const {chromium} = require('/opt/homebrew/lib/node_modules/openclaw/node_modules/playwright-core');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT  = ROOT + '/test-results/scroll-verify';
mkdirSync(OUT, {recursive:true});

const CHROME = '/Users/scottanderson/Library/Caches/ms-playwright/chromium-1246/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const BASE   = process.argv.includes('--live') ? 'https://fordengage.livecode.tech' : 'https://enroll.test';

const browser = await chromium.launch({headless:true, executablePath:CHROME});
let passed = 0;

async function test(name, fn) {
  await fn();
  passed++;
  console.log('PASS', name);
}

for (const width of [390, 1440]) {
  const page = await browser.newPage({viewport:{width, height:900}, acceptDownloads:false});

  // Serve local files for offline runs
  if (BASE !== 'https://fordengage.livecode.tech') {
    await page.route(BASE + '/**', async route => {
      const url = new URL(route.request().url());
      let pathname = url.pathname === '/' || url.pathname === '/enroll' ? '/enroll.html' : url.pathname;
      // strip cache-bust query from static assets
      const localPath = path.join(ROOT, pathname.split('?')[0]);
      try {
        const body = readFileSync(localPath);
        const ext  = path.extname(localPath);
        const ct   = ext === '.js' ? 'application/javascript' : ext === '.html' ? 'text/html' : 'application/octet-stream';
        await route.fulfill({body, contentType: ct});
      } catch { await route.fulfill({status:404, body:''}); }
    });
  }

  await page.route('https://api.zippopotam.us/**', r => r.fulfill({status:404,body:'{}'}));
  await page.route('**/submit-enrollment', r => r.fulfill({status:503,body:'{"ok":false,"error":"offline test"}',contentType:'application/json'}));

  await page.goto(BASE + '/enroll');
  await page.locator('#inline-agreement').waitFor();

  // ── A: Inline agreement box ───────────────────────────────────────────────
  await test(`[${width}] inline box: overflow-y active (scrollHeight > clientHeight)`, async () => {
    const dims = await page.locator('#inline-agreement').evaluate(el => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));
    assert.ok(dims.scrollHeight > dims.clientHeight,
      `scrollHeight ${dims.scrollHeight} must exceed clientHeight ${dims.clientHeight}`);
    assert.ok(['auto','scroll'].includes(dims.overflowY),
      `overflow-y must be auto or scroll, got ${dims.overflowY}`);
  });

  await test(`[${width}] inline box: no horizontal overflow`, async () => {
    const dims = await page.locator('#inline-agreement').evaluate(el => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    assert.ok(dims.scrollWidth <= dims.clientWidth + 2,
      `horizontal overflow: scrollWidth ${dims.scrollWidth} > clientWidth ${dims.clientWidth}`);
  });

  await test(`[${width}] inline box: programmatic scrollTop actually changes`, async () => {
    // Use scrollTo({behavior:'instant'}) — direct property write is not flushed synchronously in headless
    const scrolled = await page.locator('#inline-agreement').evaluate(el => {
      el.scrollTo({top: 99999, behavior: 'instant'});
      return el.scrollTop;
    });
    assert.ok(scrolled > 5, `scrollTop should advance; got ${scrolled}`);
  });

  await test(`[${width}] inline box: last legal clause text is reachable by scrolling`, async () => {
    const reachable = await page.locator('#inline-agreement').evaluate(el => {
      el.scrollTo({top: el.scrollHeight, behavior: 'instant'});
      const paras = el.querySelectorAll('p, div');
      const last = paras[paras.length - 1];
      if (!last) return false;
      const elRect   = el.getBoundingClientRect();
      const lastRect  = last.getBoundingClientRect();
      return lastRect.bottom <= elRect.bottom + 20;
    });
    assert.ok(reachable, 'last clause not reachable after scrolling to bottom');
  });

  await test(`[${width}] inline box: wheel scrolling not blocked (pointerEvents & touchAction)`, async () => {
    const styles = await page.locator('#inline-agreement').evaluate(el => ({
      pointerEvents: getComputedStyle(el).pointerEvents,
      touchAction:   getComputedStyle(el).touchAction,
    }));
    assert.notEqual(styles.pointerEvents, 'none', 'pointer-events must not be none');
    assert.notEqual(styles.touchAction, 'none', 'touch-action must not be none');
  });

  await test(`[${width}] inline box: native wheel advances scrollTop`, async () => {
    await page.locator('#inline-agreement').evaluate(el => el.scrollTo({top:0, behavior:'instant'}));
    await page.locator('#inline-agreement').scrollIntoViewIfNeeded();
    await page.locator('#inline-agreement').hover();
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(120);
    const afterWheel = await page.locator('#inline-agreement').evaluate(el => el.scrollTop);
    assert.ok(afterWheel > 5, `wheel did not advance scrollTop: got ${afterWheel}`);
  });

  await test(`[${width}] inline box: keyboard ArrowDown advances scrollTop`, async () => {
    await page.locator('#inline-agreement').evaluate(el => el.scrollTo({top:0, behavior:'instant'}));
    await page.locator('#inline-agreement').scrollIntoViewIfNeeded();
    await page.locator('#inline-agreement').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(80);
    const after = await page.locator('#inline-agreement').evaluate(el => el.scrollTop);
    assert.ok(after > 5, `keyboard ArrowDown did not advance scrollTop: got ${after}`);
  });

  // ── B: Expanded modal ─────────────────────────────────────────────────────
  await page.locator('#btn-expand-modal').click();
  await page.waitForFunction(() => document.getElementById('agreement-modal').getAttribute('aria-hidden') === 'false');

  await test(`[${width}] modal header visible after open`, async () => {
    const headerVisible = await page.locator('.modal-header').isVisible();
    assert.ok(headerVisible, 'modal header must be visible');
    const closeVisible  = await page.locator('#modal-close').isVisible();
    assert.ok(closeVisible, 'modal close button must be visible');
  });

  await test(`[${width}] modal body: scrollHeight > clientHeight`, async () => {
    const dims = await page.locator('#modal-agreement-body').evaluate(el => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY:    getComputedStyle(el).overflowY,
    }));
    assert.ok(dims.scrollHeight > dims.clientHeight,
      `modal body scrollHeight ${dims.scrollHeight} must exceed clientHeight ${dims.clientHeight}`);
    assert.ok(['auto','scroll'].includes(dims.overflowY),
      `modal overflow-y must be auto or scroll, got ${dims.overflowY}`);
  });

  await test(`[${width}] modal body: no horizontal overflow`, async () => {
    const dims = await page.locator('#modal-agreement-body').evaluate(el => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    assert.ok(dims.scrollWidth <= dims.clientWidth + 2,
      `modal horizontal overflow: scrollWidth ${dims.scrollWidth} > clientWidth ${dims.clientWidth}`);
  });

  await test(`[${width}] modal body: programmatic scrollTop changes`, async () => {
    const scrolled = await page.locator('#modal-agreement-body').evaluate(el => {
      el.scrollTo({top: 99999, behavior: 'instant'});
      return el.scrollTop;
    });
    assert.ok(scrolled > 5, `modal scrollTop should advance; got ${scrolled}`);
  });

  await test(`[${width}] modal body: last clause reachable`, async () => {
    const reachable = await page.locator('#modal-agreement-body').evaluate(el => {
      el.scrollTo({top: el.scrollHeight, behavior: 'instant'});
      const paras = el.querySelectorAll('p, div');
      const last  = paras[paras.length - 1];
      if (!last) return false;
      const elRect   = el.getBoundingClientRect();
      const lastRect = last.getBoundingClientRect();
      return lastRect.bottom <= elRect.bottom + 20;
    });
    assert.ok(reachable, 'last clause not reachable in modal after scrolling to bottom');
  });

  await test(`[${width}] modal body: touch-action and pointer-events not blocked`, async () => {
    const styles = await page.locator('#modal-agreement-body').evaluate(el => ({
      pointerEvents: getComputedStyle(el).pointerEvents,
      touchAction:   getComputedStyle(el).touchAction,
    }));
    assert.notEqual(styles.pointerEvents, 'none', 'modal pointer-events must not be none');
    assert.notEqual(styles.touchAction, 'none', 'modal touch-action must not be none');
  });

  await test(`[${width}] modal: close button restores focus to expand trigger`, async () => {
    await page.locator('#modal-agreement-body').evaluate(el => el.scrollTo({top:50, behavior:'instant'}));
    await page.locator('#modal-close').click();
    await page.waitForFunction(() => document.getElementById('agreement-modal').getAttribute('aria-hidden') === 'true');
    const focused = await page.evaluate(() => document.activeElement?.id);
    assert.equal(focused, 'btn-expand-modal', `focus should return to expand button, got: ${focused}`);
  });

  await test(`[${width}] modal closed: background page body overflow unlocked`, async () => {
    const overflow = await page.evaluate(() => document.body.style.overflow);
    assert.notEqual(overflow, 'hidden', 'body overflow should not remain hidden after modal closes');
  });

  // ── C: Print overflow reset ───────────────────────────────────────────────
  await test(`[${width}] print: inline scroll box hidden in print media`, async () => {
    await page.emulateMedia({media:'print'});
    const display = await page.locator('#inline-agreement').evaluate(
      el => getComputedStyle(el).display
    );
    await page.emulateMedia({media:'screen'});
    assert.equal(display, 'none', `inline scroll box must be display:none at print, got ${display}`);
  });

  await test(`[${width}] print-terms: no height or overflow constraint in print`, async () => {
    await page.emulateMedia({media:'print'});
    const styles = await page.locator('#print-terms-body').evaluate(el => ({
      height:   getComputedStyle(el).height,
      overflow: getComputedStyle(el).overflow,
    }));
    await page.emulateMedia({media:'screen'});
    // height should be 'auto' (not a px value), overflow should not be hidden/scroll
    assert.ok(!styles.height.match(/^\d+px$/) || styles.height === 'auto',
      `print-terms height should not be fixed px: ${styles.height}`);
    assert.ok(!['hidden','scroll'].includes(styles.overflow),
      `print-terms overflow must not be hidden/scroll at print: ${styles.overflow}`);
  });

  // ── D: Form state preserved ───────────────────────────────────────────────
  await test(`[${width}] form state preserved after modal open/close cycle`, async () => {
    await page.locator('[name=products][value=FordEngage]').check();
    await page.locator('#sig-name').fill('Test Signer');
    // Open and close modal
    await page.locator('#btn-expand-modal').click();
    await page.waitForFunction(() => document.getElementById('agreement-modal').getAttribute('aria-hidden') === 'false');
    await page.locator('#modal-close').click();
    await page.waitForFunction(() => document.getElementById('agreement-modal').getAttribute('aria-hidden') === 'true');
    // Check state
    const state = await page.evaluate(() => ({
      fordChecked: document.querySelector('[name=products][value=FordEngage]').checked,
      sigName:     document.getElementById('sig-name').value,
    }));
    assert.ok(state.fordChecked, 'FordEngage checkbox should remain checked');
    assert.equal(state.sigName, 'Test Signer', 'sig-name field should preserve value');
  });

  // ── Screenshots ───────────────────────────────────────────────────────────
  await page.locator('#inline-agreement').evaluate(el => { el.scrollTop = 80; });
  await page.screenshot({path:`${OUT}/inline-scrolled-${width}.png`, clip:{x:0,y:0,width:Math.min(width,1440),height:600}});

  await page.locator('#btn-expand-modal').click();
  await page.waitForFunction(() => document.getElementById('agreement-modal').getAttribute('aria-hidden') === 'false');
  await page.locator('#modal-agreement-body').evaluate(el => { el.scrollTop = 200; });
  await page.screenshot({path:`${OUT}/modal-scrolled-${width}.png`});
  await page.locator('#modal-close').click();

  await page.close();
}

await browser.close();
console.log(`\n${passed} scroll checks passed (local render, no email calls).`);
