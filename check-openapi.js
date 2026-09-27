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

  if (!url || !key) {
    console.error('Missing URL or KEY');
    return;
  }

  const res = await fetch(url + '/rest/v1/', { headers: { 'apikey': key } });
  const data = await res.json();
  
  const targetRPC = Object.keys(data.paths).find(p => p.includes('create_urgent_po'));
  if (targetRPC) {
    console.log(JSON.stringify(data.paths[targetRPC], null, 2));
  } else {
    console.log('RPC create_urgent_po not found in schema cache. Available RPCs:');
    console.log(Object.keys(data.paths).filter(p => p.startsWith('/rpc/')).join('\n'));
  }
}

main().catch(console.error);
