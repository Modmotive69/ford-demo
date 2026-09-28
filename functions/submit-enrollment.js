/**
 * Cloudflare Pages Function — POST /submit-enrollment
 * Server-side enrollment email sender via MS Graph Mail.Send.
 * Recipient is fixed here; client payload cannot override it.
 * Secrets (MS_GRAPH_*) are set in Pages project settings, never in source.
 */

const RECIPIENT  = 'Scott@smartdealer.com';       // fixed — update in CF Pages settings if changed
const SENDER     = 'scott.anderson@smartdealer.com';
const CONSENT_EXACT =
  'I certify I am authorized to submit this information on behalf of ' +
  'the dealership and have read and agree to the terms.';

// Server-side price config — JS sort order, mirrors price-lookup.js
// Client-supplied prices are never trusted; server resolves from product IDs
const PRICE_CONFIG = {
  'FordEngage':                   { price: 499,  label: '$499/mo'                    },
  'eStore':                       { price: 299,  label: '$299/mo'                    },
  'VDP Widget':                   { price: 199,  label: '$199/mo'                    },
  'FordEngage+VDP Widget':        { price: 649,  label: '$649/mo'                    },
  'FordEngage+VDP Widget+eStore': { price: 899,  label: '$899/mo'                    },
  'FordEngage+eStore':            { price: null, label: 'Contact sales for pricing'  },
  'VDP Widget+eStore':            { price: null, label: 'Contact sales for pricing'  },
};

function resolvePrice(products) {
  const key = [...products].sort().join('+');
  return PRICE_CONFIG[key] || null;
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function getToken(env) {
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     env.MS_GRAPH_CLIENT_ID,
    client_secret: env.MS_GRAPH_CLIENT_SECRET,
    scope:         'https://graph.microsoft.com/.default',
  });
  const r = await fetch(
    `https://login.microsoftonline.com/${env.MS_GRAPH_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', body }
  );
  const d = await r.json();
  if (!d.access_token) throw new Error('Auth failed: ' + (d.error_description || d.error));
  return d.access_token;
}

export async function onRequestPost({ request, env }) {
  // CORS — allow the Pages domain and the livecode.tech alias
  const origin  = request.headers.get('Origin') || '';
  const allowed = ['https://ford-demo.pages.dev', 'https://fordengage.livecode.tech'];
  const corsOrigin = allowed.includes(origin) ? origin : allowed[0];

  const cors = {
    'Access-Control-Allow-Origin':  corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const json = h => new Response(JSON.stringify(h), {
    headers: { 'Content-Type': 'application/json', ...cors }
  });

  // ── Parse ──────────────────────────────────────────────────────────────────
  let payload;
  try { payload = await request.json(); }
  catch { return json({ ok: false, error: 'Invalid JSON' }); }

  const { agreementVersion, agreementSha256, agreementText,
          selectedProducts: prods = [], configuration = '',
          enrollment = {}, signer = {}, consent = {} } = payload;

  // ── Validate ───────────────────────────────────────────────────────────────
  const errors = [];
  if (!agreementVersion)                    errors.push('agreementVersion required');
  if (!agreementSha256 || agreementSha256.length !== 64) errors.push('agreementSha256 invalid');
  if (!agreementText   || agreementText.length < 500)    errors.push('agreementText too short');
  if (!prods.length)                        errors.push('selectedProducts required');
  if (!signer.name?.trim())                 errors.push('signer.name required');
  if (!signer.email?.trim())                errors.push('signer.email required');
  if (!consent.checked)                     errors.push('consent.checked must be true');
  if (consent.text?.trim() !== CONSENT_EXACT) errors.push('consent.text does not match required text');

  // Price validation — server derives from product IDs; never trusts client amount
  let resolved = null;
  if (prods.length) {
    resolved = resolvePrice(prods);
    if (!resolved) {
      errors.push('Unknown product combination: ' + [...prods].sort().join('+'));
    } else if (resolved.price === null) {
      errors.push('Product combination requires custom quote: ' + [...prods].sort().join('+'));
    }
  }

  if (errors.length) {
    return json({ ok: false, error: errors.join('; ') });
  }

  // ── Build receipt ──────────────────────────────────────────────────────────
  const receiptId       = crypto.randomUUID();
  const serverTimestamp = new Date().toISOString();
  const priceLabel      = resolved?.label ?? 'Unknown';
  const subject =
    `FordEngage Enrollment — ${enrollment.dealer_name ?? '(no dealer)'} — ` +
    `${prods.join(', ')} — ${priceLabel} — ${receiptId.slice(0, 8)}`;

  const enrollRows = Object.entries(enrollment)
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:5px 12px;background:#f5f7fb;font-weight:bold;width:200px">${esc(k)}</td><td style="padding:5px 12px">${esc(v)}</td></tr>`)
    .join('');

  const bodyHtml = `<!doctype html><html><body style="font-family:Georgia,serif;color:#1a1a1a;max-width:700px">
<h2 style="color:#003478">FordEngage Enrollment</h2>
<table style="border-collapse:collapse;width:100%">
<tr><td style="padding:6px 12px;background:#f5f7fb;font-weight:bold;width:200px">Receipt ID</td><td style="padding:6px 12px">${esc(receiptId)}</td></tr>
<tr><td style="padding:6px 12px;font-weight:bold">Server timestamp (UTC)</td><td style="padding:6px 12px">${esc(serverTimestamp)}</td></tr>
<tr><td style="padding:6px 12px;background:#f5f7fb;font-weight:bold">Agreement version</td><td style="padding:6px 12px">${esc(agreementVersion)}</td></tr>
<tr><td style="padding:6px 12px;font-weight:bold">Agreement SHA-256</td><td style="padding:6px 12px;font-size:12px">${esc(agreementSha256)}</td></tr>
<tr><td style="padding:6px 12px;background:#f5f7fb;font-weight:bold">Selected products</td><td style="padding:6px 12px">${esc(prods.join(', '))}</td></tr>
<tr><td style="padding:6px 12px;font-weight:bold">Monthly fee (server-resolved)</td><td style="padding:6px 12px;font-weight:bold;color:#003478">${esc(priceLabel)}</td></tr>
<tr><td style="padding:6px 12px;background:#f5f7fb;font-weight:bold">Configuration</td><td style="padding:6px 12px">${esc(configuration || '—')}</td></tr>
</table>
<h3 style="color:#003478;margin-top:20px">Dealership</h3>
<table style="border-collapse:collapse;width:100%">${enrollRows}</table>
<h3 style="color:#003478;margin-top:20px">Authorized Signer</h3>
<table style="border-collapse:collapse;width:100%">
<tr><td style="padding:5px 12px;background:#f5f7fb;font-weight:bold;width:200px">Name</td><td style="padding:5px 12px">${esc(signer.name)}</td></tr>
<tr><td style="padding:5px 12px;font-weight:bold">Title</td><td style="padding:5px 12px">${esc(signer.title)}</td></tr>
<tr><td style="padding:5px 12px;background:#f5f7fb;font-weight:bold">Phone</td><td style="padding:5px 12px">${esc(signer.phone)}</td></tr>
<tr><td style="padding:5px 12px;font-weight:bold">Email</td><td style="padding:5px 12px">${esc(signer.email)}</td></tr>
</table>
<h3 style="color:#003478;margin-top:20px">Consent</h3>
<p style="background:#f5f7fb;padding:12px;border-left:3px solid #003478">${esc(consent.text)}</p>
<p>Checked: <strong>true</strong><br>Device timestamp (informational): ${esc(consent.capturedAtClient ?? '—')}</p>
<p style="font-size:12px;color:#555;margin-top:20px">
Graph 202 = send-queue accepted. Delivery subject to spam filters and recipient policy.
No database record. Email is the only server-side record.
</p>
<h3 style="color:#003478">Full Accepted Agreement Text</h3>
<pre style="font-size:11px;white-space:pre-wrap;background:#f9f9f9;padding:12px;border:1px solid #ddd">${esc(agreementText)}</pre>
</body></html>`;

  // ── Send via MS Graph ──────────────────────────────────────────────────────
  let graphStatus;
  try {
    const token = await getToken(env);
    const r = await fetch(
      `https://graph.microsoft.com/v1.0/users/${SENDER}/sendMail`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'html', content: bodyHtml },
            toRecipients: [{ emailAddress: { address: RECIPIENT } }],
          },
          saveToSentItems: true,
        }),
      }
    );
    graphStatus = r.status;
    if (graphStatus !== 200 && graphStatus !== 202) {
      const detail = await r.text();
      return json({ ok: false, error: `Graph send failed (${graphStatus})`, detail: detail.slice(0, 300) });
    }
  } catch (err) {
    return json({ ok: false, error: 'Send error: ' + err.message });
  }

  return json({
    ok:               true,
    receipt_id:       receiptId,
    server_timestamp: serverTimestamp,
    provider:         'ms-graph',
    graph_status:     graphStatus,
    resolved_price:   resolved,
    note: 'Graph accepted the send request (202). Delivery not guaranteed. No database record written.',
  });
}

// CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
