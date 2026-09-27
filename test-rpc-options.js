const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env', 'utf8');
  const env = envContent.split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if (k && v.length) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
    return acc;
  }, {});

  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const res = await fetch(url + '/rest/v1/rpc/create_urgent_po', { 
    method: 'OPTIONS',
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } 
  });
  
  console.log('Status:', res.status);
  console.log('Headers:', Object.fromEntries(res.headers.entries()));
  
  const text = await res.text();
  console.log('Body:', text);
}

main().catch(console.error);
