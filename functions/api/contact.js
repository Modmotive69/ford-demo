const ORIGINS = ['https://ford-demo.pages.dev', 'https://fordengage.livecode.tech'];
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const emailValid = s => typeof s === 'string' && s.length <= 254 && EMAIL.test(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store, private'}});

const DIST_LIST = [
  'Jeff.Fechner@SmartDealer.com',
  'david@smartdealer.com',
  'scott@smartdealer.com',
  'sandra.palacios@SmartDealer.com',
  'Edgar.Hernandez@SmartDealer.com',
];

export async function onRequestPost({request, env}) {
  if (!ORIGINS.includes(request.headers.get('Origin'))) return json({ok:false,error:'Origin not permitted.'},403);
  if (!(request.headers.get('Content-Type')||'').startsWith('application/json')) return json({ok:false,error:'JSON required.'},415);

  let p;
  try { p = await request.json(); } catch { return json({ok:false,error:'Invalid JSON.'},400); }

  const first  = (p.first  || '').trim();
  const last   = (p.last   || '').trim();
  const dealer = (p.dealer || '').trim();
  const email  = (p.email  || '').trim();
  const phone  = (p.phone  || '').trim();
  const topics = Array.isArray(p.topics) ? p.topics.filter(t => typeof t === 'string').join(', ') : '';
  const message= (p.message|| '').trim().slice(0, 4000);

  if (!first || !last || !dealer || !emailValid(email)) return json({ok:false,error:'Complete all required fields.'},400);
  if (p.honeypot) return json({ok:false,error:'Submission rejected.'},400);

  if (!env.MS_GRAPH_CLIENT_ID || !env.MS_GRAPH_CLIENT_SECRET || !env.MS_GRAPH_TENANT_ID)
    return json({ok:false,error:'Email service unavailable.'},503);

  const sender = env.ENROLLMENT_SENDER || 'scott.anderson@smartdealer.com';

  const bodyHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font:15px/1.6 Arial,sans-serif;color:#17243a;max-width:680px;margin:0 auto;padding:20px}
    h1{color:#003478;border-bottom:3px solid #003478;padding-bottom:8px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{text-align:left;width:35%;padding:8px 12px 8px 0;color:#555;vertical-align:top}
    td{padding:8px 0;border-bottom:1px solid #eee}
    .msg{background:#f5f8ff;border-left:4px solid #003478;padding:14px 16px;margin-top:20px;white-space:pre-wrap}
  </style></head><body>
  <h1>🔔 New Ford Contact Inquiry</h1>
  <table>
    <tr><th>Name</th><td>${esc(first)} ${esc(last)}</td></tr>
    <tr><th>Dealership</th><td>${esc(dealer)}</td></tr>
    <tr><th>Email</th><td>${esc(email)}</td></tr>
    ${phone ? `<tr><th>Phone</th><td>${esc(phone)}</td></tr>` : ''}
    ${topics ? `<tr><th>Topics of Interest</th><td>${esc(topics)}</td></tr>` : ''}
    <tr><th>Submitted</th><td>${new Date().toUTCString()}</td></tr>
  </table>
  ${message ? `<div class="msg">${esc(message)}</div>` : ''}
  </body></html>`;

  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(env.MS_GRAPH_TENANT_ID)}/oauth2/v2.0/token`,
      {method:'POST', body: new URLSearchParams({grant_type:'client_credentials',client_id:env.MS_GRAPH_CLIENT_ID,client_secret:env.MS_GRAPH_CLIENT_SECRET,scope:'https://graph.microsoft.com/.default'}), signal:AbortSignal.timeout(15000)}
    );
    if (!tokenRes.ok) throw new Error('auth');
    const token = await tokenRes.json();
    if (!token.access_token) throw new Error('auth');

    const sent = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
      {method:'POST', headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},
       body: JSON.stringify({message:{
         subject: `New Ford Contact — ${dealer} — ${first} ${last}`,
         body: {contentType:'HTML', content: bodyHtml},
         toRecipients: DIST_LIST.map(address => ({emailAddress:{address}})),
         replyTo: [{emailAddress:{address: email, name: `${first} ${last}`}}]
       }, saveToSentItems: true}),
       signal: AbortSignal.timeout(20000)}
    );
    if (sent.status !== 202) return json({ok:false,error:`Mail provider error (${sent.status}).`},502);
    return json({ok:true});
  } catch {
    return json({ok:false,error:'Email service unavailable. Please call (786) 892-6368.'},503);
  }
}
