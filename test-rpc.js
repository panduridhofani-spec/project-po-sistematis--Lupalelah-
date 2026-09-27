const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env', 'utf8');
  const env = envContent.split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if (k && v.length) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
    return acc;
  }, {});

  const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

  console.log('Testing RPC call...');
  
  // Test 1: EXACT MATCH as frontend currently does
  const res1 = await supabase.rpc('create_urgent_po', {
    p_operational_date: '2026-09-22',
    p_source_shift_number: 1,
    p_receiving_shift_number: 2,
    p_items: []
  });
  console.log('Test 1 (Current Frontend Args):', res1.error ? res1.error.message : 'SUCCESS');

  // Let's fetch the swagger spec using openapi.json endpoint if possible?
  const fetch = require('node-fetch'); // wait, native fetch is in node 18+
  const res = await fetch(env.EXPO_PUBLIC_SUPABASE_URL + '/rest/v1/', { 
    headers: { 'apikey': env.EXPO_PUBLIC_SUPABASE_ANON_KEY, 'Accept': 'application/openapi+json' } 
  });
  const data = await res.json();
  const targetRPC = Object.keys(data.paths || {}).find(p => p.includes('create_urgent_po'));
  if (targetRPC) {
    console.log('\n--- Swagger definition for create_urgent_po ---');
    console.log(JSON.stringify(data.paths[targetRPC], null, 2));
  } else {
    console.log('\ncreate_urgent_po not found in OpenAPI spec.');
  }
}

main().catch(console.error);
