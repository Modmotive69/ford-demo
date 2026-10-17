export async function onRequestGet({env}) {
  const results = {};
  
  // Test 1: Is SALES_DB available?
  results.sales_db_available = !!env.SALES_DB;
  
  // Test 2: Try the exact INSERT from contact.js
  try {
    const dealer = 'Debug Test Dealer';
    const email = 'debug@smartdealer.com';
    const phone = '3053357996';
    const topics = 'FordEngage';
    const message = 'debug test';
    
    await env.SALES_DB.prepare(`INSERT INTO dealers (
      dealer_name, primary_email, primary_phone,
      pipeline_status, source_tab, notes, last_contacted, created_at, updated_at
    ) VALUES (?,?,?,'contacted','fordengage.com contact form',?,datetime('now'),datetime('now'),datetime('now'))`)
    .bind(
      dealer||'New Lead',
      email||null, phone||null,
      [topics?'Topics: '+topics:'', message?'Message: '+message:''].filter(Boolean).join(' · ')
    ).run();
    results.insert = 'SUCCESS';
  } catch(e) {
    results.insert = 'FAILED: ' + e.message;
    results.stack = e.stack;
  }
  
  return new Response(JSON.stringify(results, null, 2), {
    headers: {'Content-Type':'application/json'}
  });
}
