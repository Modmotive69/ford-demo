// Public corrections are suggestions only; never mutate the dealer directory.
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
export async function onRequest({request, env}) {
  if (request.method !== 'POST') return json({error: 'Method not allowed'}, 405);
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) return json({error: 'Origin not allowed'}, 403);
  if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return json({error: 'JSON required'}, 415);
  if (Number(request.headers.get('Content-Length')) > 8192) return json({error: 'Payload too large'}, 413);
  let body;
  try {
    // Stream with a byte limit; Content-Length alone is not trustworthy.
    const reader = request.body?.getReader();
    if (!reader) return json({error: 'JSON required'}, 400);
    const chunks = []; let length = 0;
    for (;;) {
      const {done, value} = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 8192) { await reader.cancel(); return json({error: 'Payload too large'}, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return json({error: 'Invalid JSON'}, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({error: 'Invalid correction'}, 400);
  const limits = {original_pacode: 20, original_zip: 5, name: 200, street: 300, city: 100, state: 2, phone: 40, email: 254, submitted_at: 40};
  const data = {};
  for (const [key, limit] of Object.entries(limits)) {
    const value = body[key] ?? '';
    if (typeof value !== 'string' || value.length > limit || /[\x00-\x1f]/.test(value)) return json({error: 'Invalid field: ' + key}, 400);
    data[key] = value.trim();
  }
  if (!/^\d{5}$/.test(data.original_zip) || !data.name || !data.street || !data.city || !/^[A-Z]{2}$/.test(data.state) || !Number.isFinite(Date.parse(data.submitted_at)) || (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))) return json({error: 'Invalid correction'}, 400);
  try {
    await env.ENROLLMENT_DB.prepare(`CREATE TABLE IF NOT EXISTS dealer_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT, original_pacode TEXT, original_zip TEXT,
      name TEXT, street TEXT, city TEXT, state TEXT, phone TEXT, email TEXT, submitted_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
    await env.ENROLLMENT_DB.prepare(`INSERT INTO dealer_corrections
      (original_pacode,original_zip,name,street,city,state,phone,email,submitted_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).bind(...Object.keys(limits).map(key => data[key])).run();
    return json({ok: true});
  } catch { return json({error: 'Correction storage unavailable'}, 503); }
}
