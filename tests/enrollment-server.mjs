import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const agreement = JSON.parse(readFileSync(new URL('../server/agreement.json', import.meta.url)));
const source = readFileSync(new URL('../functions/submit-enrollment.js', import.meta.url), 'utf8')
  .replace("import agreement from '../server/agreement.json';", `const agreement=${JSON.stringify(agreement)};`);
const {onRequestPost} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

let ip = 0, tests = 0, mail = [];

function environment() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  return {
    MS_GRAPH_CLIENT_ID:'synth', MS_GRAPH_CLIENT_SECRET:'***', MS_GRAPH_TENANT_ID:'synth',
    ENROLLMENT_DB: {
      prepare(q) {
        return { bind(...args) { return {
          async first()  { return sql.prepare(q).get(...args); },
          async run()    { return { meta:{ changes: sql.prepare(q).run(...args).changes } }; },
        };}}
      }
    }
  };
}

/** Build a valid baseline payload for a given term */
function payload(termId = 'month-to-month', products = ['FordEngage']) {
  return {
    submissionId: crypto.randomUUID(),
    termId,
    agreementVersion: agreement.version,
    agreementSha256:  agreement.sha256,
    agreementText:    agreement.terms.join('\n'),
    selectedProducts: products,
    configuration:    'Synthetic test',
    enrollment: {
      dealer_name:'SYNTHETIC TEST — not an enrollment', pa_code:'TEST',
      address:'123 Test St', city:'Detroit', state:'MI', zip:'48201',
      pc_first:'Synthetic', pc_last:'Tester', pc_title:'General Manager',
      pc_email:'scott.anderson@smartdealer.com',
      pc_phone:'', ap_first:'', ap_last:'', ap_email:'', ap_phone:'',
    },
    signer: { name:'Synthetic Signer', title:'General Manager', phone:'555-555-0100', email:'scott.anderson@smartdealer.com' },
    consent: { checked:true, text:agreement.consent, capturedAtClient:new Date().toISOString() },
  };
}

async function send(p, env = environment(), origin = 'https://fordengage.livecode.tech', sameIp, { accumulate = false } = {}) {
  if (!accumulate) mail = [];
  globalThis.fetch = async (url, options) => {
    if (url.includes('oauth2')) return Response.json({ access_token: '***' });
    mail.push(JSON.parse(options.body));
    return new Response(null, { status: 202 });
  };
  const response = await onRequestPost({env, request: new Request('https://fordengage.livecode.tech/submit-enrollment', {
    method:'POST', headers:{ Origin:origin, 'Content-Type':'application/json', 'CF-Connecting-IP': sameIp || `synth-${++ip}` },
    body: JSON.stringify(p),
  })});
  return { status: response.status, data: await response.json(), cache: response.headers.get('Cache-Control') };
}

async function test(name, fn) { await fn(); tests++; console.log('PASS', name); }

// ── 5 priced combinations × 3 terms ─────────────────────────────────────────
const pricedCombos = [
  { products:['FordEngage'],                           baseCents:49900  },
  { products:['eStore'],                               baseCents:29900  },
  { products:['VDP Widget'],                           baseCents:19900  },
  { products:['FordEngage','VDP Widget'],              baseCents:64900  },
  { products:['eStore','FordEngage','VDP Widget'],     baseCents:89900  },
];
const terms = {
  'month-to-month': { factor:1.00,  setupCents:100000, discountPct:0  },
  '1year':          { factor:0.90,  setupCents:0,      discountPct:10 },
  '2year':          { factor:0.75,  setupCents:0,      discountPct:25 },
};

for (const {products, baseCents} of pricedCombos) {
  for (const [termId, tc] of Object.entries(terms)) {
    await test(`price/setup/discount — ${products.join('+')} × ${termId}`, async () => {
      const p = payload(termId, products);
      const r = await send(p);
      assert.equal(r.status, 200, r.data.error);
      const rp = r.data.resolved_price;
      // Cents-safe check: server must match JS round(baseCents * factor)
      const expectedDisc = Math.round(baseCents * tc.factor);
      assert.equal(rp.baseCents,        baseCents,        `baseCents mismatch for ${products.join('+')}`);
      assert.equal(rp.discountedCents,  expectedDisc,     `discountedCents mismatch for ${products.join('+')} ${termId}`);
      assert.equal(rp.discountPct,      tc.discountPct,   `discountPct mismatch`);
      assert.equal(rp.setupCents,       tc.setupCents,    `setupCents mismatch`);
      assert.equal(rp.termId,           termId);
      // Confirm in email and agreement HTML
      const html = r.data.agreement_html;
      const fmtCents = c => '$' + (c/100).toFixed(2).replace(/\.00$/,'');
      assert.ok(html.includes(fmtCents(baseCents) + '/mo'), 'base in HTML');
      assert.ok(html.includes(fmtCents(expectedDisc) + '/mo'), 'discounted in HTML');
      if (tc.setupCents > 0) assert.ok(html.includes('$1,000') || html.includes('setup'), 'setup in HTML');
      else assert.ok(html.includes('Waived'), 'setup waived in HTML');
      // One email, no extras
      assert.equal(mail.length, 1);
    });
  }
}

// ── 2 quote-required combos ──────────────────────────────────────────────────
for (const products of [['FordEngage','eStore'], ['VDP Widget','eStore']]) {
  await test(`quote-required rejected — ${products.join('+')}`, async () => {
    const p = payload('month-to-month', products);
    const r = await send(p);
    assert.equal(r.data.ok, false);
    assert.ok([400,409].includes(r.status));
    assert.equal(mail.length, 0);
  });
}

// ── Unknown / tampered term rejected ─────────────────────────────────────────
await test('unknown term rejected', async () => {
  const p = payload('5year'); const r = await send(p);
  assert.equal(r.data.ok, false); assert.equal(r.status, 400); assert.equal(mail.length, 0);
});
await test('tampered term string rejected', async () => {
  const p = payload('month-to-month'); p.termId = 'month-to-month; DROP TABLE enrollment_receipts; --';
  const r = await send(p);
  assert.equal(r.data.ok, false); assert.equal(mail.length, 0);
});

// ── Duplicate / idempotency ──────────────────────────────────────────────────
await test('same payload + term = one send, same receipt', async () => {
  const env = environment(); const p = payload('1year');
  mail = [];
  const first = await send(p, env, undefined, undefined, {accumulate:true});
  assert.equal(first.data.ok, true);
  const afterFirst = mail.length;
  assert.equal(afterFirst, 1);
  const retry = await send(p, env, undefined, undefined, {accumulate:true});
  assert.equal(retry.data.receipt_id, first.data.receipt_id);
  assert.equal(mail.length, afterFirst); // no additional send on retry
});
await test('different term = different receipt', async () => {
  const env = environment();
  const p1 = payload('1year'); const p2 = payload('2year');
  const r1 = await send(p1, env); const r2 = await send(p2, env);
  assert.notEqual(r1.data.receipt_id, r2.data.receipt_id);
});

// ── Validation guards ─────────────────────────────────────────────────────────
for (const [name, mutate] of [
  ['missing consent',           p => p.consent.checked = false],
  ['wrong consent text',        p => p.consent.text = 'yes'],
  ['invalid primary email',     p => p.enrollment.pc_email = 'invalid'],
  ['email header injection',    p => p.enrollment.pc_email = 'scott@sd.com\r\nBcc: x@x.com'],
  ['multi-address injection',   p => p.enrollment.pc_email = 'a@b.com,c@d.com'],
  ['tampered legal text',       p => p.agreementText += ' tampered'],
  ['tampered version',          p => p.agreementVersion = 'x'],
  ['tampered hash',             p => p.agreementSha256 = '0'.repeat(64)],
  ['duplicate product',         p => p.selectedProducts = ['FordEngage','FordEngage']],
  ['unknown product',           p => p.selectedProducts = ['x']],
  ['bad phone',                 p => p.signer.phone = 'x'],
  ['missing dealer',            p => p.enrollment.dealer_name = ''],
  ['honeypot',                  p => p.website = 'spam'],
  ['object field',              p => p.enrollment.pc_email = {x:1}],
  ['bad timestamp',             p => p.consent.capturedAtClient = 'nonsense'],
  ['no term',                   p => delete p.termId],
]) {
  await test(name, async () => {
    const p = payload(); mutate(p);
    const r = await send(p);
    assert.equal(r.data.ok, false);
    assert.equal(mail.length, 0, `Mail was unexpectedly sent for: ${name}`);
  });
}

// ── Pricing consistency: confirmation matches email matches HTML ──────────────
await test('server receipt, email subject, and HTML all show same prices', async () => {
  const p = payload('1year', ['FordEngage']);
  const r = await send(p);
  assert.equal(r.status, 200);
  const rp = r.data.resolved_price;
  // baseCents=49900, disc=round(49900*0.90)=44910 → $449.10/mo
  assert.equal(rp.baseCents, 49900);
  assert.equal(rp.discountedCents, 44910);
  assert.equal(rp.setupCents, 0);
  const subject = mail[0].message.subject;
  assert.ok(subject.includes('FordEngage'), 'subject has product');
  const html = r.data.agreement_html;
  assert.ok(html.includes('$499/mo'), 'base in HTML');
  assert.ok(html.includes('$449.10/mo'), 'discounted in HTML');
  assert.ok(html.includes('Waived'), 'setup waived in HTML');
  assert.ok(html.includes('10%'), 'discount % in HTML');
});

// ── Recipients still correct ─────────────────────────────────────────────────
await test('exactly Scott + primary contact sent, no extras', async () => {
  const p = payload('2year');
  const r = await send(p);
  assert.equal(r.data.email_recipients.length, 2);
  assert.ok(r.data.email_recipients.includes('scott@smartdealer.com'));
  assert.ok(r.data.email_recipients.includes('scott.anderson@smartdealer.com'));
  assert.equal(mail[0].message.toRecipients.length, 2);
});
await test('same primary contact and Scott deduplicates to one', async () => {
  const p = payload('month-to-month'); p.enrollment.pc_email = 'Scott@smartdealer.com';
  const r = await send(p);
  assert.equal(mail[0].message.toRecipients.length, 1);
});

// ── HTML escaping ────────────────────────────────────────────────────────────
await test('HTML escapes signer name', async () => {
  const p = payload(); p.signer.name = '<script>alert(1)</script>';
  const r = await send(p);
  assert.ok(!r.data.agreement_html.includes('<script>'));
  assert.ok(r.data.agreement_html.includes('&lt;script&gt;'));
});

// ── Rate limit ───────────────────────────────────────────────────────────────
await test('IP rate limit prevents sixth submission', async () => {
  const env = environment(); mail = [];
  for (let i = 0; i < 5; i++) { const p = payload(); p.enrollment.dealer_name += i; await send(p, env, undefined, 'same-ip', {accumulate:true}); }
  assert.equal(mail.length, 5);
  const r6 = await send(payload(), env, undefined, 'same-ip');
  assert.equal(r6.status, 429);
});

// ── Storage failure ──────────────────────────────────────────────────────────
await test('missing ENROLLMENT_DB fails closed', async () => {
  const env = environment(); delete env.ENROLLMENT_DB;
  const r = await send(payload(), env);
  assert.equal(r.status, 503); assert.equal(mail.length, 0);
});

// ── Cache-control ────────────────────────────────────────────────────────────
await test('response is no-store', async () => {
  const r = await send(payload());
  assert.match(r.cache, /no-store/);
});

console.log(`\n${tests} server checks passed; no external email calls made.`);
