import agreement from '../server/agreement.json';

const ORIGINS = ['https://ford-demo.pages.dev', 'https://fordengage.livecode.tech'];
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2,'0')).join('');
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
const emailValid = s => typeof s === 'string' && s.length <= 254 && EMAIL.test(s);
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const phoneValid = s => /^(?:\+1[ .-]?)?(?:\([0-9]{3}\)|[0-9]{3})[ .-]?[0-9]{3}[ .-]?[0-9]{4}$/.test(s);

/** Cents-safe price resolution: mirrors price-lookup.js exactly */
function resolvePricingServer(products, termId) {
  const key   = [...products].sort().join('+');
  const entry = agreement.priceConfig[key];
  if (!entry || entry.price === null) return null; // quote-required
  const tc        = agreement.termConfig[termId];
  if (!tc) return null; // unknown term
  const baseCents = Math.round(entry.price * 100);
  const discCents = Math.round(baseCents * tc.discountFactor);
  const fmt       = c => '$' + (c / 100).toFixed(2).replace(/\.00$/, '');
  return {
    key,
    termId,
    termLabel:       tc.label,
    termMonths:      tc.termMonths,
    discountPct:     tc.discountPct,
    baseCents,
    baseLabel:       fmt(baseCents) + '/mo',
    discountedCents: discCents,
    discountedLabel: fmt(discCents) + '/mo',
    // legacy label field used in email subject and receipt table
    label: tc.discountPct > 0
      ? fmt(discCents) + '/mo (' + tc.discountPct + '% off base ' + fmt(baseCents) + '/mo, ' + tc.label + ')' +
        (tc.setupCents === 0 ? ', setup waived' : ' + ' + tc.setupLabel)
      : fmt(discCents) + '/mo + ' + tc.setupLabel,
    setupCents:  tc.setupCents,
    setupLabel:  tc.setupLabel,
  };
}

export function renderAgreement(r) {
  const p = r.resolved_price;
  const rows = [
    ['Receipt ID',                  r.receipt_id],
    ['Accepted (UTC)',              r.server_timestamp],
    ['Agreement version',           r.agreementVersion],
    ['SHA-256',                     r.agreementSha256],
    ['Products',                    r.selectedProducts.join(' + ')],
    ['Commitment term',             p.termLabel],
    ['Base monthly fee',            p.baseLabel],
    ...(p.discountPct > 0 ? [
      ['Discount',                  p.discountPct + '%'],
      ['Discounted monthly fee',    p.discountedLabel],
    ] : [
      ['Monthly fee',               p.discountedLabel],
    ]),
    ['One-time setup',              p.setupCents === 0 ? 'Waived' : p.setupLabel],
    ['Configuration',               r.configuration || 'Not specified'],
    ...Object.entries(r.enrollment).filter(([,v]) => v),
    ['Consent statement',           r.consent.text],
    ['Consent accepted',            'Yes — authorized representative confirmed'],
    ['Device timestamp (info only)', r.consent.capturedAtClient],
  ];
  const esigBlock = `<div style="margin:28px 0 0;padding:20px;border:2px solid #003478;border-radius:6px;background:#f5f8ff">
<h2 style="margin:0 0 12px;font-size:1.1rem;color:#003478">Electronic Acceptance</h2>
<table style="width:100%;border-collapse:collapse">
<tr><th style="text-align:left;padding:7px 12px 7px 0;width:38%;vertical-align:top;color:#555">Electronically signed by</th><td style="padding:7px 0;font-weight:700">${esc(r.signer.name)}</td></tr>
<tr><th style="text-align:left;padding:7px 12px 7px 0;vertical-align:top;color:#555">Title</th><td style="padding:7px 0">${esc(r.signer.title)}</td></tr>
<tr><th style="text-align:left;padding:7px 12px 7px 0;vertical-align:top;color:#555">Email</th><td style="padding:7px 0">${esc(r.signer.email)}</td></tr>
<tr><th style="text-align:left;padding:7px 12px 7px 0;vertical-align:top;color:#555">Phone</th><td style="padding:7px 0">${esc(r.signer.phone)}</td></tr>
<tr><th style="text-align:left;padding:7px 12px 7px 0;vertical-align:top;color:#555">On behalf of</th><td style="padding:7px 0">${esc(r.enrollment.dealer_name || '')}</td></tr>
<tr><th style="text-align:left;padding:7px 12px 7px 0;vertical-align:top;color:#555">Accepted (server timestamp, UTC)</th><td style="padding:7px 0;font-weight:700">${esc(r.server_timestamp)}</td></tr>
<tr><th style="text-align:left;padding:7px 12px 7px 0;vertical-align:top;color:#555">Receipt ID</th><td style="padding:7px 0;font-family:monospace;font-size:0.9rem">${esc(r.receipt_id)}</td></tr>
<tr><th style="text-align:left;padding:7px 12px 7px 0;vertical-align:top;color:#555">Agreement version accepted</th><td style="padding:7px 0">${esc(r.agreementVersion)}</td></tr>
</table>
<p style="margin:14px 0 0;font-size:0.85rem;color:#555">This record was generated server-side upon successful submission. The full accepted agreement text is appended below. PartSites, LLC has received this submission and will be in contact to complete onboarding.</p>
</div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>FordEngage Submitted Agreement — ${esc(r.signer.name)}</title><style>body{font:16px/1.5 Georgia,serif;max-width:900px;margin:24px auto;padding:0 20px;color:#17243a}h1,h2{color:#003478}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid #ddd;overflow-wrap:anywhere}th{width:32%}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;font-size:0.9rem}@media print{body{margin:0;font-size:10pt}tr{break-inside:avoid}h2{page-break-before:auto}}</style></head><body><h1>FordEngage — Submitted Agreement</h1>${esigBlock}<h2 style="margin-top:32px">Product &amp; Price Summary</h2><table>${rows.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table><h2 style="margin-top:32px">Full Accepted Agreement Text</h2><pre>${esc(r.agreementText)}</pre></body></html>`;
}

function replyExisting(row) {
  const r = JSON.parse(row.receipt);
  if (row.state === 'queued') return json({ok:true,...r, email_status:'queued', agreement_html:renderAgreement(r)});
  return json({ok:false, receipt_id:r.receipt_id, error: row.state === 'failed'
    ? 'The email provider rejected this submission. Contact support with this receipt; do not submit a second agreement.'
    : 'Submission is processing or its email status needs confirmation. Retry with the same entries; do not create a second agreement.'}, 409);
}

export async function onRequestPost({request, env}) {
  if (!ORIGINS.includes(request.headers.get('Origin'))) return json({ok:false,error:'Request origin not permitted.'},403);
  if (!(request.headers.get('Content-Type')||'').startsWith('application/json')) return json({ok:false,error:'JSON required.'},415);
  if (Number(request.headers.get('Content-Length')||0)>48000) return json({ok:false,error:'Request too large.'},413);
  let p;
  try {
    const reader=request.body.getReader(); let size=0; const chunks=[];
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>48000){await reader.cancel();return json({ok:false,error:'Request too large.'},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    p=JSON.parse(new TextDecoder().decode(bytes));
  } catch {return json({ok:false,error:'Invalid request.'},400);}

  if (!object(p)||!object(p.enrollment)||!object(p.signer)||!object(p.consent)) return json({ok:false,error:'Missing enrollment, signer or consent.'},400);
  if (p.website) return json({ok:false,error:'Submission rejected.'},400);
  if (!UUID.test(p.submissionId||'')) return json({ok:false,error:'Invalid submission identifier.'},400);
  if (p.agreementVersion!==agreement.version||p.agreementSha256!==agreement.sha256||
      (p.agreementText!==undefined&&p.agreementText!==agreement.terms.join('\n')))
    return json({ok:false,error:'Agreement version changed. Reload and review the current terms before submitting.'},409);

  const products = p.selectedProducts;
  if (!Array.isArray(products)||products.length<1||products.length>3||new Set(products).size!==products.length||
      products.some(v=>!['FordEngage','VDP Widget','eStore'].includes(v)))
    return json({ok:false,error:'Select valid products.'},400);

  // Term validation — server-authoritative; reject unknown or tampered term
  const termId = p.termId;
  if (!termId || !agreement.termConfig[termId])
    return json({ok:false,error:'Select a valid commitment term (month-to-month, 1year, or 2year).'},400);

  // Server resolves price from authoritative config — client price never trusted
  const resolved = resolvePricingServer(products, termId);
  if (!resolved) {
    const entry = agreement.priceConfig[[...products].sort().join('+')];
    if (!entry || entry.price === null)
      return json({ok:false,error:'This product combination requires a custom quote.'},400);
    return json({ok:false,error:'Unknown term. Select a valid commitment option.'},400);
  }

  const fields = ['dealer_name','pa_code','address','city','state','zip','pc_first','pc_last','pc_title','pc_email','pc_phone','ap_first','ap_last','ap_email','ap_phone'];
  const enrollment={};const signer={};
  for (const k of fields) {
    const v=p.enrollment[k]??'';
    if(typeof v!=='string'||v.length>300||/[\x00-\x1f\x7f]/.test(v))return json({ok:false,error:'Invalid dealership/contact field.'},400);
    enrollment[k]=v.trim();
  }
  for (const k of ['name','title','email','phone']) {
    const v=p.signer[k];
    if(typeof v!=='string'||!v.trim()||v.length>254||/[\x00-\x1f\x7f]/.test(v))return json({ok:false,error:'Complete all signer fields.'},400);
    signer[k]=v.trim();
  }
  if (['dealer_name','pa_code','address','city','state','zip','pc_first','pc_last','pc_title'].some(k=>!enrollment[k])||
      !/^\d{5}(?:-\d{4})?$/.test(enrollment.zip)||!/^[A-Z]{2}$/.test(enrollment.state)||
      !emailValid(enrollment.pc_email)||!emailValid(signer.email)||!phoneValid(signer.phone)||
      (enrollment.ap_email&&!emailValid(enrollment.ap_email)))
    return json({ok:false,error:'Complete valid dealership, primary-contact and signer information.'},400);
  if (p.consent.checked!==true||p.consent.text!==agreement.consent)
    return json({ok:false,error:'Read and accept the agreement authorization and consent.'},400);
  if (typeof p.configuration!=='string'||p.configuration.length>2000)
    return json({ok:false,error:'Configuration is too long or invalid.'},400);
  const captured=p.consent.capturedAtClient;
  if(typeof captured!=='string'||captured.length>40||!Number.isFinite(Date.parse(captured)))
    return json({ok:false,error:'Invalid consent timestamp.'},400);

  const recipient=env.ENROLLMENT_RECIPIENT||'Scott@smartdealer.com';
  const sender=env.ENROLLMENT_SENDER||'scott.anderson@smartdealer.com';
  if(!env.ENROLLMENT_DB||!emailValid(recipient)||!emailValid(sender)||
     !env.MS_GRAPH_CLIENT_ID||!env.MS_GRAPH_CLIENT_SECRET||!env.MS_GRAPH_TENANT_ID)
    return json({ok:false,error:'Submission service is temporarily unavailable. Your entries have not been submitted.'},503);

  const db=env.ENROLLMENT_DB;
  // Fingerprint includes termId so same entries + different term = different receipt
  const stable={agreementVersion:agreement.version,selectedProducts:[...products].sort(),termId,configuration:p.configuration.trim(),enrollment,signer};
  const fingerprint=await hash(JSON.stringify(stable));
  let r;
  try {
    const now=Date.now();
    const buckets=[['ip',request.headers.get('CF-Connecting-IP')||'unknown',Math.floor(now/3600000),5],
                   ['email',enrollment.pc_email.toLowerCase(),Math.floor(now/86400000),20]];
    for (const [kind,value,window,max] of buckets) {
      const key=await hash(`${kind}:${value}:${window}`);
      const count=await db.prepare('INSERT INTO enrollment_limits(bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+172800000).first();
      if(count.count>max) return json({ok:false,error:'Too many requests. Please wait before trying again.'},429);
    }
    await db.prepare('DELETE FROM enrollment_limits WHERE expires_at < ?').bind(now).run();
    const prior=await db.prepare('SELECT * FROM enrollment_receipts WHERE id=? OR fingerprint=?').bind(p.submissionId,fingerprint).first();
    if (prior) {
      if (prior.fingerprint!==fingerprint) return json({ok:false,error:'Submission identifier conflict.'},409);
      return replyExisting(prior);
    }
    r={
      receipt_id:        crypto.randomUUID(),
      server_timestamp:  new Date().toISOString(),
      ...stable,
      agreementSha256:   agreement.sha256,
      agreementText:     agreement.terms.join('\n'),
      resolved_price:    resolved,
      consent:{checked:true,text:agreement.consent,capturedAtClient:captured},
      email_recipients:  [...new Set([recipient.toLowerCase(),enrollment.pc_email.toLowerCase()])],
    };
    const insert=await db.prepare("INSERT OR IGNORE INTO enrollment_receipts(id,fingerprint,state,receipt,created_at) VALUES (?,?,'sending',?,?)").bind(r.receipt_id,fingerprint,JSON.stringify(r),r.server_timestamp).run();
    if (!insert.meta.changes) {
      const prior=await db.prepare('SELECT * FROM enrollment_receipts WHERE id=? OR fingerprint=?').bind(p.submissionId,fingerprint).first();
      return replyExisting(prior);
    }
  } catch { return json({ok:false,error:'Submission storage unavailable. Keep your entries and retry with the same submission.'},503); }

  let sendStarted=false;
  try {
    const tokenRes=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(env.MS_GRAPH_TENANT_ID)}/oauth2/v2.0/token`,
      {method:'POST',body:new URLSearchParams({grant_type:'client_credentials',client_id:env.MS_GRAPH_CLIENT_ID,client_secret:env.MS_GRAPH_CLIENT_SECRET,scope:'https://graph.microsoft.com/.default'}),signal:AbortSignal.timeout(15000)});
    if(!tokenRes.ok) throw new Error('auth');
    const token=await tokenRes.json();if(!token.access_token) throw new Error('auth');
    sendStarted=true;
    const subject=`FordEngage Agreement — ${enrollment.dealer_name} — ${products.join('+')} — ${resolved.label} — ${r.receipt_id}`;
    const sent=await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
      {method:'POST',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},
       body:JSON.stringify({message:{subject,body:{contentType:'HTML',content:renderAgreement(r)},toRecipients:r.email_recipients.map(address=>({emailAddress:{address}}))},saveToSentItems:true}),
       signal:AbortSignal.timeout(20000)});
    if (sent.status!==202) {
      await db.prepare("UPDATE enrollment_receipts SET state='failed' WHERE id=?").bind(r.receipt_id).run();
      return json({ok:false,receipt_id:r.receipt_id,error:`Email provider did not accept the request (${sent.status}). Contact support with this receipt; do not submit a second agreement.`},502);
    }
    await db.prepare("UPDATE enrollment_receipts SET state='queued' WHERE id=?").bind(r.receipt_id).run();
    return json({ok:true,...r,email_status:'queued',agreement_html:renderAgreement(r)});
  } catch {
    try {await db.prepare('UPDATE enrollment_receipts SET state=? WHERE id=?').bind(sendStarted?'uncertain':'failed',r.receipt_id).run();}catch{}
    return json({ok:false,receipt_id:r.receipt_id,error:sendStarted
      ?'Provider confirmation unavailable. Retry with the same entries to check status; do not create a second agreement.'
      :'Email service unavailable. Contact support with this receipt; your entries are preserved.'},503);
  }
}

export function onRequestGet() { return json({ok:false,error:'Use POST.'},405); }
